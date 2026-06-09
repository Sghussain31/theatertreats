/* global Buffer */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mysql = require('mysql2/promise');
const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, CopyObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Configure Multer memory storage for direct buffer upload to S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Configure AWS S3 Client (v3)
let s3Client;
try {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'placeholder',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'placeholder',
    },
  });
  console.log('AWS S3 Client initialized.');
} catch (error) {
  console.error('Failed to initialize AWS S3 Client:', error.message);
}

// Database pool variable
let dbPool;

// On-Memory Product Cache
let productCache = [];

// Virtual in-memory fallbacks for offline mode
let virtualSettings = {
  canteen_status: 'open'
};

let virtualStaffDailyLedger = [];

// Helper to log staff change to staff_daily_ledger table (or virtual in-memory fallback)
async function logStaffChange(username, mobile, rolesArray, theatresArray) {
  const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const rolesStr = Array.isArray(rolesArray) ? rolesArray.join(', ') : String(rolesArray || '');
  const theatresStr = Array.isArray(theatresArray) ? theatresArray.join(', ') : String(theatresArray || '');

  if (dbPool) {
    try {
      await dbPool.execute(
        'INSERT INTO staff_daily_ledger (date, username, mobile, roles, theatre) VALUES (?, ?, ?, ?, ?)',
        [currentDate, username, mobile, rolesStr, theatresStr]
      );
      // console.log(`Logged staff change to DB ledger: ${username} (${mobile}) -> Roles: ${rolesStr}, Theatres: ${theatresStr}`);
    } catch (err) {
      console.error('Failed to write to staff_daily_ledger, using virtual fallback:', err.message);
      virtualStaffDailyLedger.push({
        date: currentDate,
        username,
        mobile,
        roles: rolesStr,
        theatre: theatresStr
      });
    }
  } else {
    virtualStaffDailyLedger.push({
      date: currentDate,
      username,
      mobile,
      roles: rolesStr,
      theatre: theatresStr
    });
    // console.log(`Logged staff change to virtual ledger: ${username} (${mobile}) -> Roles: ${rolesStr}, Theatres: ${theatresStr}`);
  }
}

async function uploadToS3(key, data) {
  if (!s3Client) {
    throw new Error('S3 Client is not initialized');
  }
  const bucketName = process.env.AWS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('AWS_BUCKET_NAME environment variable is not set');
  }

  const body = JSON.stringify(data, null, 2);
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: 'application/json'
  });

  await s3Client.send(command);
  // console.log(`Successfully uploaded to S3: s3://${bucketName}/${key}`);
}

async function s3FileExists(bucketName, key) {
  if (!s3Client) return false;
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: bucketName,
      Key: key
    }));
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    console.warn(`[s3FileExists] Error checking head for ${key}:`, err.message);
    return false;
  }
}

async function toggleProductStatusS3(oldProd, newStatus) {
  if (!s3Client || !process.env.AWS_BUCKET_NAME) return { success: true };
  const bucketName = process.env.AWS_BUCKET_NAME;

  const sanitizedId = oldProd.id.toString().replace(/[^0-9a-zA-Z]/g, '').trim();
  const oldFilename = generateS3FileName(sanitizedId, oldProd.name, oldProd.price, oldProd.status, oldProd.displayOrder);
  
  const oldDetailsKey = oldProd.detailsKey || `products/${oldFilename}.txt`;
  const oldImageKey = oldProd.imageKey || `images/${sanitizedId}.jpg`;

  const newFilename = generateS3FileName(sanitizedId, oldProd.name, oldProd.price, newStatus, oldProd.displayOrder);

  // Preserve extensions safely
  const detailsExt = oldDetailsKey.includes('.') ? oldDetailsKey.substring(oldDetailsKey.lastIndexOf('.')) : '.txt';
  const newDetailsKey = `products/${newFilename}${detailsExt}`;
  const newImageKey = `images/${sanitizedId}.jpg`;

  // console.log(`[Status Toggle S3 Keys]`);
  // console.log(`  Old Image Key:   "${oldImageKey}"`);
  // console.log(`  New Image Key:   "${newImageKey}"`);
  // console.log(`  Old Details Key: "${oldDetailsKey}"`);
  // console.log(`  New Details Key: "${newDetailsKey}"`);

  // Rename Details key
  if (oldDetailsKey !== newDetailsKey) {
    if (await s3FileExists(bucketName, oldDetailsKey)) {
      // console.log(`[S3 Toggle Rename] Initiating CopyObject for details key...`);
      await s3Client.send(new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: encodeURI(`/${bucketName}/${oldDetailsKey}`),
        Key: newDetailsKey
      }));
      // console.log(`[S3 Toggle Rename] Initiating DeleteObject for old details key...`);
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: oldDetailsKey
      }));
    } else {
      console.warn(`[S3 Toggle Rename] Details key ${oldDetailsKey} does not exist. Writing new details file.`);
      const detailsContent = `Name: ${oldProd.name}\nPrice: ${oldProd.price}\nCategory: ${oldProd.category || 'General'}\nStatus: ${newStatus}\nDisplayOrder: ${oldProd.displayOrder}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: newDetailsKey,
        Body: Buffer.from(detailsContent, 'utf8'),
        ContentType: 'text/plain'
      }));
    }
  }

  // Rename Image key if different (e.g. migration from old flat structure)
  if (oldImageKey !== newImageKey) {
    if (await s3FileExists(bucketName, oldImageKey)) {
      // console.log(`[S3 Toggle Rename] Initiating CopyObject for image key...`);
      await s3Client.send(new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: encodeURI(`/${bucketName}/${oldImageKey}`),
        Key: newImageKey
      }));
      // console.log(`[S3 Toggle Rename] Initiating DeleteObject for old image key...`);
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: oldImageKey
      }));
    } else {
      console.warn(`[S3 Toggle Rename] Image key ${oldImageKey} does not exist. Skipping image rename.`);
    }
  }

  return {
    newDetailsKey,
    newImageKey,
    newPublicS3Url: buildS3PublicUrl(newImageKey)
  };
}

async function renameS3Object(oldKey, newKey) {
  if (!s3Client || !process.env.AWS_BUCKET_NAME) return;
  if (oldKey === newKey) return;
  const bucketName = process.env.AWS_BUCKET_NAME;
  try {
    if (await s3FileExists(bucketName, oldKey)) {
      // console.log(`[S3 Rename] Copying ${oldKey} to ${newKey}...`);
      await s3Client.send(new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: encodeURI(`/${bucketName}/${oldKey}`),
        Key: newKey
      }));
      // console.log(`[S3 Rename] Deleting old key ${oldKey}...`);
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: oldKey
      }));
    } else {
      console.warn(`[S3 Rename] Old key ${oldKey} not found in S3.`);
    }
  } catch (err) {
    console.error(`[S3 Rename Error] Failed to rename ${oldKey} to ${newKey}:`, err.message);
  }
}


async function performS3Archiving() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // console.log(`Starting daily S3 archiving for ${dateStr}...`);

  // 1. Fetch orders placed today
  let ordersToExport = [];
  if (dbPool) {
    try {
      const [rows] = await dbPool.execute('SELECT * FROM orders WHERE DATE(created_at) = CURDATE()');
      ordersToExport = rows.map(r => {
        let items = [];
        try {
          items = typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []);
        } catch (e) {
          items = r.items || [];
        }
        return {
          id: r.id,
          total_price: Number(r.total_price),
          order_type: r.order_type,
          seat_number: r.seat_number,
          status: r.status,
          items: items,
          theatre: r.theatre,
          delivery_man: r.delivery_man,
          mobile: r.mobile,
          created_at: r.created_at
        };
      });
    } catch (err) {
      console.error('Error querying orders for S3 sync, using virtual fallback:', err.message);
      const todayStr = new Date().toDateString();
      ordersToExport = virtualOrders.filter(o => {
        const orderDate = new Date(o.timestamp);
        return orderDate.toDateString() === todayStr;
      });
    }
  } else {
    const todayStr = new Date().toDateString();
    ordersToExport = virtualOrders.filter(o => {
      const orderDate = new Date(o.timestamp);
      return orderDate.toDateString() === todayStr;
    });
  }

  // 2. Fetch staff assignments for today
  let ledgerToExport = [];
  if (dbPool) {
    try {
      const [rows] = await dbPool.execute('SELECT * FROM staff_daily_ledger WHERE date = CURDATE()');
      ledgerToExport = rows;
    } catch (err) {
      console.error('Error querying staff daily ledger for S3 sync, using virtual fallback:', err.message);
      const todayStr = new Date().toISOString().slice(0, 10);
      ledgerToExport = virtualStaffDailyLedger.filter(l => l.date === todayStr);
    }
  } else {
    const todayStr = new Date().toISOString().slice(0, 10);
    ledgerToExport = virtualStaffDailyLedger.filter(l => l.date === todayStr);
  }

  // 3. Divide today's arrays into theater-specific sub-arrays
  // Matches '70mm Screen Desk' or contains '70mm'
  const screen70mmOrders = ordersToExport.filter(o => {
    const t = o.theatre || '';
    return t.includes('70mm') || t.includes('70mm Screen Desk');
  });

  // Matches '35mm Screen Desk' or contains '35mm'
  const screen35mmOrders = ordersToExport.filter(o => {
    const t = o.theatre || '';
    return t.includes('35mm') || t.includes('35mm Screen Desk');
  });

  // Matches '70mm Screen Desk' or contains '70mm' (e.g., in a comma-separated list)
  const screen70mmLedger = ledgerToExport.filter(l => {
    const t = l.theatre || '';
    return t.includes('70mm') || t.includes('70mm Screen Desk');
  });

  // Matches '35mm Screen Desk' or contains '35mm' (e.g., in a comma-separated list)
  const screen35mmLedger = ledgerToExport.filter(l => {
    const t = l.theatre || '';
    return t.includes('35mm') || t.includes('35mm Screen Desk');
  });

  // console.log(`Split completed. 70mm Screen Desk Orders: ${screen70mmOrders.length}, 35mm Screen Desk Orders: ${screen35mmOrders.length}`);
  // console.log(`Split completed. 70mm Screen Desk Ledgers: ${screen70mmLedger.length}, 35mm Screen Desk Ledgers: ${screen35mmLedger.length}`);

  const uploadedKeys = [];
  const bypassedKeys = [];
  const uploadErrors = [];

  // 70mm Screen Desk Orders Upload
  if (screen70mmOrders.length > 0) {
    const key = `70mm_Screen_Desk/transactions/year=${year}/month=${month}/day=${day}/daily_orders.json`;
    try {
      await uploadToS3(key, screen70mmOrders);
      uploadedKeys.push(key);
    } catch (err) {
      console.error(`Failed to upload 70mm Screen Desk orders to S3 at ${key}:`, err.message);
      uploadErrors.push(`70mm Screen Desk orders upload failed: ${err.message}`);
    }
  } else {
    // console.log(`Bypassing 70mm Screen Desk orders upload stream (0 records found)`);
    bypassedKeys.push(`70mm_Screen_Desk/transactions/year=${year}/month=${month}/day=${day}/daily_orders.json`);
  }

  // 35mm Screen Desk Orders Upload
  if (screen35mmOrders.length > 0) {
    const key = `35mm_Screen_Desk/transactions/year=${year}/month=${month}/day=${day}/daily_orders.json`;
    try {
      await uploadToS3(key, screen35mmOrders);
      uploadedKeys.push(key);
    } catch (err) {
      console.error(`Failed to upload 35mm Screen Desk orders to S3 at ${key}:`, err.message);
      uploadErrors.push(`35mm Screen Desk orders upload failed: ${err.message}`);
    }
  } else {
    // console.log(`Bypassing 35mm Screen Desk orders upload stream (0 records found)`);
    bypassedKeys.push(`35mm_Screen_Desk/transactions/year=${year}/month=${month}/day=${day}/daily_orders.json`);
  }

  // 70mm Screen Desk Ledger Upload
  if (screen70mmLedger.length > 0) {
    const key = `70mm_Screen_Desk/staff-ledgers/year=${year}/month=${month}/${dateStr}_staff_assignments.json`;
    try {
      await uploadToS3(key, screen70mmLedger);
      uploadedKeys.push(key);
    } catch (err) {
      console.error(`Failed to upload 70mm Screen Desk staff ledger to S3 at ${key}:`, err.message);
      uploadErrors.push(`70mm Screen Desk staff ledger upload failed: ${err.message}`);
    }
  } else {
    // console.log(`Bypassing 70mm Screen Desk staff ledger upload stream (0 records found)`);
    bypassedKeys.push(`70mm_Screen_Desk/staff-ledgers/year=${year}/month=${month}/${dateStr}_staff_assignments.json`);
  }

  // 35mm Screen Desk Ledger Upload
  if (screen35mmLedger.length > 0) {
    const key = `35mm_Screen_Desk/staff-ledgers/year=${year}/month=${month}/${dateStr}_staff_assignments.json`;
    try {
      await uploadToS3(key, screen35mmLedger);
      uploadedKeys.push(key);
    } catch (err) {
      console.error(`Failed to upload 35mm Screen Desk staff ledger to S3 at ${key}:`, err.message);
      uploadErrors.push(`35mm Screen Desk staff ledger upload failed: ${err.message}`);
    }
  } else {
    // console.log(`Bypassing 35mm Screen Desk staff ledger upload stream (0 records found)`);
    bypassedKeys.push(`35mm_Screen_Desk/staff-ledgers/year=${year}/month=${month}/${dateStr}_staff_assignments.json`);
  }

  if (uploadErrors.length > 0) {
    throw new Error(uploadErrors.join('; '));
  }

  return {
    date: dateStr,
    screen70mmOrdersCount: screen70mmOrders.length,
    screen35mmOrdersCount: screen35mmOrders.length,
    screen70mmStaffCount: screen70mmLedger.length,
    screen35mmStaffCount: screen35mmLedger.length,
    uploadedKeys,
    bypassedKeys,
    success: true
  };
}

async function generateDailyReport() {
  if (!s3Client) {
    throw new Error('S3 Client is not initialized');
  }
  const bucketName = process.env.AWS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('AWS_BUCKET_NAME environment variable is not set');
  }

  // 1. Get sorted products (the synchronized tracking array data)
  const sortedProducts = getSortedProducts();

  // 2. Clean any empty/invalid entries
  const activeProducts = sortedProducts.filter(p => p && p.id && p.name);

  // 3. Map the index parameters with zero-padded positions ('01_', '02_')
  const lines = activeProducts.map((product, index) => {
    const position = String(index + 1).padStart(2, '0') + '_';
    const name = product.name.replace(/\s+/g, '-');
    return `${position}$#$${product.id}$#$${name}$#$${product.price}$#$${product.status}`;
  });

  // 4. Join the lines using a clean string newline joiner ('\n')
  const fileContent = lines.join('\n');

  // 5. File storage key
  const dateToken = new Date().toISOString().split('T')[0];
  const key = `reports/report_${dateToken}.txt`;

  // 6. Upload to S3 with 'text/plain' ContentType
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: Buffer.from(fileContent, 'utf8'),
    ContentType: 'text/plain'
  });

  await s3Client.send(command);
  // console.log(`Successfully generated and uploaded daily report: s3://${bucketName}/${key}`);
  return key;
}

function getMsUntil1159PM() {
  const now = new Date();
  const target = new Date();
  target.setHours(23, 59, 0, 0); // 11:59 PM

  let delay = target.getTime() - now.getTime();
  if (delay < 0) {
    // Already past 11:59 PM today, set for 11:59 PM tomorrow
    target.setDate(target.getDate() + 1);
    delay = target.getTime() - now.getTime();
  }
  return delay;
}

function startSyncScheduler() {
  const delay = getMsUntil1159PM();
  const targetTimeStr = new Date(Date.now() + delay).toLocaleString();
  console.log(`S3 Archiving Scheduler initialized. Next run scheduled at: ${targetTimeStr} (in ${(delay / 1000 / 60).toFixed(2)} minutes)`);

  setTimeout(async function runAndReschedule() {
    try {
      // console.log('Automated S3 archiving scheduler triggering at 11:59 PM...');
      const summary = await performS3Archiving();
      // console.log('Automated S3 archiving scheduler completed successfully:', summary);
      try {
        await generateDailyReport();
        // console.log('Automated daily report generated successfully.');
      } catch (repErr) {
        console.error('Automated daily report generation encountered an error:', repErr.message);
      }
    } catch (err) {
      console.error('Automated S3 archiving scheduler encountered an error:', err.message);
    } finally {
      // Schedule the next one for exactly 24 hours later
      const nextDelay = getMsUntil1159PM();
      const nextTargetStr = new Date(Date.now() + nextDelay).toLocaleString();
      // console.log(`Rescheduling next automated S3 archiving run for: ${nextTargetStr}`);
      setTimeout(runAndReschedule, nextDelay);
    }
  }, delay);
}


let virtualOrders = [
  {
    id: 'order_101',
    mobile: '9848022338',
    seat: 'Row F - Seat 12',
    fulfillmentType: 'Seat Delivery',
    items: [{ id: 'prod_popcorn', name: 'Popcorn Large', price: 150, quantity: 2, category: 'Snacks' }],
    total: 300,
    status: 'pending',
    timestamp: Date.now() - 1000 * 60 * 12, // 12 min ago
    theatre: '35mm Screen Desk',
    deliveryMan: 'Ramesh Kumar'
  },
  {
    id: 'order_102',
    mobile: '9900112233',
    seat: 'Balcony - A4',
    fulfillmentType: 'Seat Delivery',
    items: [
      { id: 'prod_samosa', name: 'Samosa (2pcs)', price: 80, quantity: 1, category: 'Snacks' },
      { id: 'prod_cooldrink', name: 'Cool Drink', price: 60, quantity: 1, category: 'Beverages' }
    ],
    total: 140,
    status: 'pending',
    timestamp: Date.now() - 1000 * 60 * 8, // 8 min ago
    theatre: '70mm Screen Desk',
    deliveryMan: 'Suresh Kumar'
  },
  {
    id: 'order_103',
    mobile: '9848033445',
    seat: 'Premium - G15',
    fulfillmentType: 'Seat Delivery',
    items: [
      { id: 'prod_vegburger', name: 'Veg Burger', price: 120, quantity: 1, category: 'Snacks' },
      { id: 'prod_coffee', name: 'Coffee', price: 50, quantity: 2, category: 'Beverages' }
    ],
    total: 220,
    status: 'cooking',
    timestamp: Date.now() - 1000 * 60 * 15, // 15 min ago
    theatre: '35mm Screen Desk',
    deliveryMan: 'Ramesh Kumar'
  },
  {
    id: 'order_104',
    mobile: '9123456789',
    seat: 'Row K - Seat 5',
    fulfillmentType: 'Seat Delivery',
    items: [{ id: 'prod_popcorn', name: 'Popcorn Large', price: 150, quantity: 1, category: 'Snacks' }],
    total: 150,
    status: 'cooking',
    timestamp: Date.now() - 1000 * 60 * 5, // 5 min ago
    theatre: '70mm Screen Desk',
    deliveryMan: 'Suresh Kumar'
  },
  {
    id: 'order_105',
    mobile: '9888776655',
    seat: 'Row J - Seat 10',
    fulfillmentType: 'Seat Delivery',
    items: [{ id: 'prod_cooldrink', name: 'Cool Drink', price: 60, quantity: 4, category: 'Beverages' }],
    total: 240,
    status: 'ready',
    timestamp: Date.now() - 1000 * 60 * 20, // 20 min ago
    theatre: '35mm Screen Desk',
    deliveryMan: 'Ramesh Kumar'
  },
  {
    id: 'order_106',
    mobile: '9777665544',
    seat: 'Row B - Seat 8',
    fulfillmentType: 'Seat Delivery',
    items: [{ id: 'prod_samosa', name: 'Samosa (2pcs)', price: 80, quantity: 2, category: 'Snacks' }],
    total: 160,
    status: 'ready',
    timestamp: Date.now() - 1000 * 60 * 10, // 10 min ago
    theatre: '70mm Screen Desk',
    deliveryMan: 'Suresh Kumar'
  },
  {
    id: 'order_107',
    mobile: '9666554433',
    seat: 'Counter Pickup',
    fulfillmentType: 'Counter Pickup',
    items: [
      { id: 'prod_popcorn', name: 'Popcorn Large', price: 150, quantity: 1, category: 'Snacks' },
      { id: 'prod_cooldrink', name: 'Cool Drink', price: 60, quantity: 2, category: 'Beverages' }
    ],
    total: 270,
    status: 'delivered',
    timestamp: Date.now() - 1000 * 60 * 45, // 45 min ago
    theatre: '35mm Screen Desk'
  },
  {
    id: 'order_108',
    mobile: '9555443322',
    seat: 'Balcony - C10',
    fulfillmentType: 'Seat Delivery',
    items: [{ id: 'prod_vegburger', name: 'Veg Burger', price: 120, quantity: 2, category: 'Snacks' }],
    total: 240,
    status: 'delivered',
    timestamp: Date.now() - 1000 * 60 * 30, // 30 min ago
    theatre: '70mm Screen Desk',
    deliveryMan: 'Suresh Kumar'
  }
];

// Whitelisted staff fallback array for mock/offline mode
let mockStaff = [
  { id: '1', name: 'admin', phone: '1234567890', role: 'Admin', roles: ['Admin'], theatres: ['35mm Screen Desk', '70mm Screen Desk'] },
  { id: '2', name: 'admin2', phone: '1234567891', role: 'Admin', roles: ['Admin'], theatres: ['35mm Screen Desk', '70mm Screen Desk'] },
  { id: '3', name: 'cashier1', phone: '9876543210', role: 'Cashier', roles: ['Cashier'], theatres: ['35mm Screen Desk'] },
  { id: '4', name: 'kitchen1', phone: '5555555555', role: 'Kitchen', roles: ['Kitchen'], theatres: ['70mm Screen Desk'] },
  { id: '5', name: 'delivery1', phone: '1111111111', role: 'Delivery', roles: ['Delivery'], theatres: ['35mm Screen Desk'] },
  { id: '6', name: 'multitasker', phone: '9999999999', role: 'Cashier', roles: ['Cashier', 'Kitchen'], theatres: ['35mm Screen Desk', '70mm Screen Desk'] }
];

// Initialize Database connection, tables, and seed initial records if empty
async function initDb() {
  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '3306', 10),
  };

  try {
    // 1. Connect to host first to create database if not exists
    console.log(`Connecting to database host ${dbConfig.host}:${dbConfig.port}...`);
    const connection = await mysql.createConnection(dbConfig);
    const dbName = process.env.DB_NAME || 'canteen_db';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();
    console.log(`Database "${dbName}" ensured/created.`);

    // 2. Connect to the specific database with a Connection Pool
    dbPool = mysql.createPool({
      ...dbConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // 3. Create products table with image_url column if not exists
    await dbPool.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        image_url VARCHAR(512) NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        is_available BOOLEAN DEFAULT TRUE
      )
    `);
    console.log('Table "products" ensured/created with image_url column.');

    // Migration: alter products table to add display_order column if it doesn't exist
    try {
      await dbPool.execute('ALTER TABLE products ADD COLUMN display_order INT DEFAULT 1');
      console.log('Migration: Added column "display_order" to "products" table.');
    } catch (e) {
      // Column already exists
    }

    // 3b. Create orders table with all production columns
    await dbPool.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(50) PRIMARY KEY,
        total_price DECIMAL(10, 2) NOT NULL,
        order_type VARCHAR(50) NOT NULL,
        seat_number VARCHAR(50),
        status VARCHAR(50) NOT NULL,
        items JSON NOT NULL,
        theatre VARCHAR(100),
        delivery_man VARCHAR(100),
        mobile VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table "orders" ensured/created.');

    // Migration logic: alter existing orders table to add missing columns if they don't exist
    try {
      await dbPool.execute('ALTER TABLE orders ADD COLUMN theatre VARCHAR(100)');
      console.log('Migration: Added column "theatre" to "orders" table.');
    } catch (e) {
      // Column already exists
    }
    try {
      await dbPool.execute('ALTER TABLE orders ADD COLUMN delivery_man VARCHAR(100)');
      console.log('Migration: Added column "delivery_man" to "orders" table.');
    } catch (e) {
      // Column already exists
    }
    try {
      await dbPool.execute('ALTER TABLE orders ADD COLUMN mobile VARCHAR(50)');
      console.log('Migration: Added column "mobile" to "orders" table.');
    } catch (e) {
      // Column already exists
    }

    // Create settings table
    await dbPool.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key_name VARCHAR(255) PRIMARY KEY,
        value_value VARCHAR(255) NOT NULL
      )
    `);
    console.log('Table "settings" ensured/created.');

    // Seed default canteen status if not set
    const [settingRows] = await dbPool.execute('SELECT COUNT(*) as count FROM settings WHERE key_name = "canteen_status"');
    if (settingRows[0].count === 0) {
      await dbPool.execute('INSERT INTO settings (key_name, value_value) VALUES ("canteen_status", "open")');
      console.log('Seeded default canteen status "open".');
    }

    // Create staff table if not exists
    await dbPool.execute(`
      CREATE TABLE IF NOT EXISTS staff (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        role VARCHAR(100) NOT NULL,
        roles JSON NOT NULL,
        theatres JSON NOT NULL
      )
    `);
    console.log('Table "staff" ensured/created.');

    // Create staff_daily_ledger table if not exists
    await dbPool.execute(`
      CREATE TABLE IF NOT EXISTS staff_daily_ledger (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        username VARCHAR(255) NOT NULL,
        mobile VARCHAR(50) NOT NULL,
        roles VARCHAR(255) NOT NULL,
        theatre VARCHAR(255) NOT NULL
      )
    `);
    console.log('Table "staff_daily_ledger" ensured/created.');

    // Ensure database indexing parameters are configured for optimal query performance
    try {
      await dbPool.execute('CREATE INDEX idx_staff_phone ON staff (phone)');
      console.log('Index idx_staff_phone ensured/created.');
    } catch (e) {
      // Index already exists or not supported
    }

    try {
      await dbPool.execute('CREATE INDEX idx_staff_daily_ledger_date ON staff_daily_ledger (date)');
      console.log('Index idx_staff_daily_ledger_date ensured/created.');
    } catch (e) {
      // Index already exists or not supported
    }

    try {
      await dbPool.execute('CREATE INDEX idx_orders_created_at ON orders (created_at)');
      console.log('Index idx_orders_created_at ensured/created.');
    } catch (e) {
      // Index already exists or not supported
    }

    try {
      await dbPool.execute('CREATE INDEX idx_orders_mobile ON orders (mobile)');
      console.log('Index idx_orders_mobile ensured/created.');
    } catch (e) {
      // Index already exists or not supported
    }

    // Seed staff table if it is empty
    const [staffRows] = await dbPool.execute('SELECT COUNT(*) as count FROM staff');
    if (staffRows[0].count === 0) {
      console.log('Seeding initial staff records into database...');
      const defaultStaff = [
        { id: '1', name: 'admin', phone: '1234567890', role: 'Admin', roles: JSON.stringify(['Admin']), theatres: JSON.stringify(['35mm Screen Desk', '70mm Screen Desk']) },
        { id: '2', name: 'admin2', phone: '1234567891', role: 'Admin', roles: JSON.stringify(['Admin']), theatres: JSON.stringify(['35mm Screen Desk', '70mm Screen Desk']) },
        { id: '3', name: 'cashier1', phone: '9876543210', role: 'Cashier', roles: JSON.stringify(['Cashier']), theatres: JSON.stringify(['35mm Screen Desk']) },
        { id: '4', name: 'kitchen1', phone: '5555555555', role: 'Kitchen', roles: JSON.stringify(['Kitchen']), theatres: JSON.stringify(['70mm Screen Desk']) },
        { id: '5', name: 'delivery1', phone: '1111111111', role: 'Delivery', roles: JSON.stringify(['Delivery']), theatres: JSON.stringify(['35mm Screen Desk']) },
        { id: '6', name: 'multitasker', phone: '9999999999', role: 'Cashier', roles: JSON.stringify(['Cashier', 'Kitchen']), theatres: JSON.stringify(['35mm Screen Desk', '70mm Screen Desk']) }
      ];
      for (const s of defaultStaff) {
        await dbPool.execute(
          'INSERT INTO staff (id, name, phone, role, roles, theatres) VALUES (?, ?, ?, ?, ?, ?)',
          [s.id, s.name, s.phone, s.role, s.roles, s.theatres]
        );
      }
      console.log('Seeding initial staff records complete.');
    }

    // Seed orders table if it is empty
    const [orderCountRows] = await dbPool.execute('SELECT COUNT(*) as count FROM orders');
    if (orderCountRows[0].count === 0) {
      console.log('Seeding initial order records into database...');
      const defaultOrders = [
        {
          id: 'order_101',
          total_price: 300,
          order_type: 'seat_delivery',
          seat_number: 'Row F - Seat 12',
          status: 'pending',
          items: JSON.stringify([{ id: 'prod_popcorn', name: 'Popcorn Large', price: 150, quantity: 2, category: 'Snacks' }]),
          theatre: '35mm Screen Desk',
          delivery_man: 'Ramesh Kumar',
          mobile: '9848022338'
        },
        {
          id: 'order_102',
          total_price: 140,
          order_type: 'seat_delivery',
          seat_number: 'Balcony - A4',
          status: 'pending',
          items: JSON.stringify([
            { id: 'prod_samosa', name: 'Samosa (2pcs)', price: 80, quantity: 1, category: 'Snacks' },
            { id: 'prod_cooldrink', name: 'Cool Drink', price: 60, quantity: 1, category: 'Beverages' }
          ]),
          theatre: '70mm Screen Desk',
          delivery_man: 'Suresh Kumar',
          mobile: '9900112233'
        },
        {
          id: 'order_103',
          total_price: 220,
          order_type: 'seat_delivery',
          seat_number: 'Premium - G15',
          status: 'cooking',
          items: JSON.stringify([
            { id: 'prod_vegburger', name: 'Veg Burger', price: 120, quantity: 1, category: 'Snacks' },
            { id: 'prod_coffee', name: 'Coffee', price: 50, quantity: 2, category: 'Beverages' }
          ]),
          theatre: '35mm Screen Desk',
          delivery_man: 'Ramesh Kumar',
          mobile: '9848033445'
        },
        {
          id: 'order_104',
          total_price: 150,
          order_type: 'seat_delivery',
          seat_number: 'Row K - Seat 5',
          status: 'cooking',
          items: JSON.stringify([{ id: 'prod_popcorn', name: 'Popcorn Large', price: 150, quantity: 1, category: 'Snacks' }]),
          theatre: '70mm Screen Desk',
          delivery_man: 'Suresh Kumar',
          mobile: '9123456789'
        },
        {
          id: 'order_105',
          total_price: 240,
          order_type: 'seat_delivery',
          seat_number: 'Row J - Seat 10',
          status: 'ready',
          items: JSON.stringify([{ id: 'prod_cooldrink', name: 'Cool Drink', price: 60, quantity: 4, category: 'Beverages' }]),
          theatre: '35mm Screen Desk',
          delivery_man: 'Ramesh Kumar',
          mobile: '9888776655'
        },
        {
          id: 'order_106',
          total_price: 160,
          order_type: 'seat_delivery',
          seat_number: 'Row B - Seat 8',
          status: 'ready',
          items: JSON.stringify([{ id: 'prod_samosa', name: 'Samosa (2pcs)', price: 80, quantity: 2, category: 'Snacks' }]),
          theatre: '70mm Screen Desk',
          delivery_man: 'Suresh Kumar',
          mobile: '9777665544'
        },
        {
          id: 'order_107',
          total_price: 270,
          order_type: 'counter_pickup',
          seat_number: 'Counter Pickup',
          status: 'delivered',
          items: JSON.stringify([
            { id: 'prod_popcorn', name: 'Popcorn Large', price: 150, quantity: 1, category: 'Snacks' },
            { id: 'prod_cooldrink', name: 'Cool Drink', price: 60, quantity: 2, category: 'Beverages' }
          ]),
          theatre: '35mm Screen Desk',
          delivery_man: null,
          mobile: '9666554433'
        },
        {
          id: 'order_108',
          total_price: 240,
          order_type: 'seat_delivery',
          seat_number: 'Balcony - C10',
          status: 'delivered',
          items: JSON.stringify([{ id: 'prod_vegburger', name: 'Veg Burger', price: 120, quantity: 2, category: 'Snacks' }]),
          theatre: '70mm Screen Desk',
          delivery_man: 'Suresh Kumar',
          mobile: '9555443322'
        }
      ];
      for (const o of defaultOrders) {
        await dbPool.execute(
          'INSERT INTO orders (id, total_price, order_type, seat_number, status, items, theatre, delivery_man, mobile) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [o.id, o.total_price, o.order_type, o.seat_number, o.status, o.items, o.theatre, o.delivery_man, o.mobile]
        );
      }
      console.log('Seeding initial order records complete.');
    }

    console.log('Database initialization complete.');
  } catch (error) {
    console.error('Database connection or initialization failed:', error.message);
    console.log('Server running in fallback mock mode until database is available.');
  }
}

function generateS3FileName(id, name, price, status, displayOrder) {
  const cleanName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const twoDigitOrder = String(displayOrder || 1).padStart(2, '0');
  return `${twoDigitOrder}_$#$${id}$#$${cleanName}$#$${price}$#$${status}`;
}

const getSortedProducts = () => {
  return [...productCache].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
};

async function scanProductsFromS3() {
  if (!s3Client) {
    throw new Error('S3 Client is not initialized');
  }
  const bucketName = process.env.AWS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('AWS_BUCKET_NAME environment variable is not set');
  }

  // console.log(`[S3 Scan] Scanning products/ folder...`);
  
  // List files only within the products/ prefix
  const data = await s3Client.send(new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: 'products/'
  }));

  const contents = data.Contents || [];
  const loadedProducts = {};

  for (const obj of contents) {
    try {
      const key = obj.Key;
      
      // Intercept and silently drop malformed or system files (like .DS_Store)
      if (key.includes('.DS_Store') || key.includes('__MACOSX') || path.basename(key).startsWith('.')) {
        continue;
      }

      // Lock down the file processing loops to exclusively scan new structured directories
      if (!key.startsWith('products/') || !key.endsWith('.txt')) {
        continue;
      }

      // Strip out the folder prefixes before parsing tokens
      const cleanKey = key.replace('products/', '').replace('reports/', '');
      
      // Skip any file that does not contain '$#$' without crashing
      if (!cleanKey.includes('$#$')) {
        continue;
      }

      const filename = path.basename(cleanKey);
      let rawFilename = filename;
      try {
        rawFilename = decodeURIComponent(filename);
      } catch (e) { /* ignore */ }
      rawFilename = rawFilename.trim();
      const normalizedKey = rawFilename.replace(/[\$#]+/g, '$#$');
      const tokens = normalizedKey.split('$#$');

      let id = '';
      let displayOrder = 1;
      let cleanName = '';
      let price = 0;
      let status = 'active';

      if (tokens && tokens.length >= 5 && tokens[0] && tokens[0].endsWith('_')) {
        // New format: 01_$#$1068$#$name$#$price$#$status.txt
        displayOrder = parseInt(tokens[0].slice(0, -1), 10) || 1;
        id = tokens[1] ? tokens[1].replace(/[^0-9a-zA-Z]/g, '').trim() : '';
        cleanName = tokens[2] ? tokens[2].replace(/^[\$#\s]+|[\$#\s]+$/g, '').replace(/-/g, ' ').trim() : '';
        price = parseFloat(tokens[3]) || 0;
        
        // Strict null/undefined checks
        if (!tokens || tokens.length < 5 || !tokens[4]) continue;
        const statusPart = tokens[4].split('.')[0];
        if (!statusPart) continue;
        status = statusPart.trim().toLowerCase();
      } else if (tokens && tokens.length >= 4) {
        // Old format: 1068$#$name$#$price$#$status$#$displayOrder.txt
        id = tokens[0] ? tokens[0].replace(/[^0-9a-zA-Z]/g, '').trim() : '';
        cleanName = tokens[1] ? tokens[1].replace(/^[\$#\s]+|[\$#\s]+$/g, '').replace(/-/g, ' ').trim() : '';
        price = parseFloat(tokens[2]) || 0;
        
        if (!tokens || tokens.length < 4 || !tokens[3]) continue;
        const statusPart = tokens[3].split('.')[0];
        if (!statusPart) continue;
        status = statusPart.trim().toLowerCase();
        displayOrder = (tokens.length >= 5 && tokens[4]) ? parseInt(tokens[4].split('.')[0]) || 1 : 1;
      } else {
        continue;
      }

      // Map image keys directly by sanitized product ID (images/${id}.jpg)
      const matchedImageKey = `images/${id}.jpg`;
      const imageUri = buildS3PublicUrl(matchedImageKey);

      const lastModified = obj.LastModified ? new Date(obj.LastModified).getTime() : 0;
      
      if (!loadedProducts[id] || lastModified > loadedProducts[id]._lastModified) {
        loadedProducts[id] = {
          id: id,
          name: cleanName,
          price: price,
          status: status,
          image_url: imageUri,
          imageUri: imageUri,
          category: 'General',
          isAvailable: status.startsWith('active'),
          displayOrder: displayOrder,
          detailsKey: key, // Full path containing products/ prefix
          imageKey: matchedImageKey,
          _lastModified: lastModified
        };
      }
    } catch (err) {
      console.error(`[S3 Scan Error] Failed to parse key ${obj.Key}:`, err.message);
      continue;
    }
  }

  const productsList = Object.values(loadedProducts).map(p => {
    const { _lastModified, ...cleanProd } = p;
    return cleanProd;
  });

  // Sort by the custom position token (displayOrder)
  productsList.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  return productsList;
}



async function syncProductS3(oldProd, newProd, imageFile) {
  if (!s3Client || !process.env.AWS_BUCKET_NAME) return;
  const bucketName = process.env.AWS_BUCKET_NAME;
  
  const sanitizedId = newProd.id.toString().replace(/[^0-9a-zA-Z]/g, '').trim();

  // Construct old keys (fallback to products/ and images/ subfolders)
  const oldFilename = oldProd ? generateS3FileName(oldProd.id, oldProd.name, oldProd.price, oldProd.status, oldProd.displayOrder) : null;
  const oldImageKey = oldProd ? (oldProd.imageKey || `images/${sanitizedId}.jpg`) : null;
  const oldDetailsKey = oldProd ? (oldProd.detailsKey || `products/${oldFilename}.txt`) : null;
  
  // Construct new keys (products/ and images/ subfolders)
  const newFilename = generateS3FileName(newProd.id, newProd.name, newProd.price, newProd.status, newProd.displayOrder);
  const newImageKey = `images/${sanitizedId}.jpg`;
  const newDetailsKey = `products/${newFilename}.txt`;
  
  try {
    // 1. Upload or copy image
    if (imageFile) {
      // Upload new image
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: newImageKey,
        Body: imageFile.buffer,
        ContentType: imageFile.mimetype || 'image/jpeg'
      }));
      // console.log(`[Background S3] Uploaded new image to ${newImageKey}`);
      // If the key changed, delete the old image
      if (oldImageKey && oldImageKey !== newImageKey) {
        if (await s3FileExists(bucketName, oldImageKey)) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: oldImageKey
          }));
          // console.log(`[Background S3] Deleted old image ${oldImageKey}`);
        }
      }
    } else if (oldImageKey) {
      // No new image, but key might have changed due to status toggle or metadata edit
      if (oldImageKey !== newImageKey) {
        if (await s3FileExists(bucketName, oldImageKey)) {
          await s3Client.send(new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: encodeURI(`/${bucketName}/${oldImageKey}`),
            Key: newImageKey
          }));
          await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: oldImageKey
          }));
          // console.log(`[Background S3] Renamed image from ${oldImageKey} to ${newImageKey}`);
        } else {
          console.warn(`[Background S3] Image key ${oldImageKey} does not exist. Skipping rename.`);
        }
      }
    }
    
    // 2. Upload or copy details text file
    if (!imageFile && oldDetailsKey) {
      // Status toggle or metadata edit: CopyObject followed by DeleteObject
      if (oldDetailsKey !== newDetailsKey) {
        if (await s3FileExists(bucketName, oldDetailsKey)) {
          await s3Client.send(new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: encodeURI(`/${bucketName}/${oldDetailsKey}`),
            Key: newDetailsKey
          }));
          await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: oldDetailsKey
          }));
          // console.log(`[Background S3] Renamed details from ${oldDetailsKey} to ${newDetailsKey}`);
        } else {
          // If details doesn't exist, write it
          const detailsContent = `Name: ${newProd.name}\nPrice: ${newProd.price}\nCategory: ${newProd.category || 'General'}\nStatus: ${newProd.status}\nDisplayOrder: ${newProd.displayOrder}`;
          await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: newDetailsKey,
            Body: Buffer.from(detailsContent, 'utf8'),
            ContentType: 'text/plain'
          }));
          // console.log(`[Background S3] Created new details file at ${newDetailsKey}`);
        }
      }
    } else {
      // New product upload or image uploaded with new details: PutObjectCommand
      const detailsContent = `Name: ${newProd.name}\nPrice: ${newProd.price}\nCategory: ${newProd.category || 'General'}\nStatus: ${newProd.status}\nDisplayOrder: ${newProd.displayOrder}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: newDetailsKey,
        Body: Buffer.from(detailsContent, 'utf8'),
        ContentType: 'text/plain'
      }));
      // console.log(`[Background S3] Uploaded details to ${newDetailsKey}`);
      
      // Delete old details if key changed
      if (oldDetailsKey && oldDetailsKey !== newDetailsKey) {
        if (await s3FileExists(bucketName, oldDetailsKey)) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: oldDetailsKey
          }));
          // console.log(`[Background S3] Deleted old details ${oldDetailsKey}`);
        }
      }
    }

    // Update newProd properties in-place so cache remains accurate
    newProd.detailsKey = newDetailsKey;
    newProd.imageKey = newImageKey;
    newProd.image_url = buildS3PublicUrl(newImageKey);
    newProd.imageUri = buildS3PublicUrl(newImageKey);
  } catch (err) {
    console.error(`[Background S3 Error] Sync failed for product ${newProd.id}:`, err.message);
  }
}

async function deleteProductS3Background(prod) {
  if (!s3Client || !process.env.AWS_BUCKET_NAME) return;
  const bucketName = process.env.AWS_BUCKET_NAME;
  
  const sanitizedId = prod.id.toString().replace(/[^0-9a-zA-Z]/g, '').trim();
  const filename = generateS3FileName(prod.id, prod.name, prod.price, prod.status, prod.displayOrder);
  const detailsKey = prod.detailsKey || `products/${filename}.txt`;
  const imageKey = prod.imageKey || `images/${sanitizedId}.jpg`;
  
  const detailsFilename = path.basename(detailsKey);
  const archiveKey = `deleted_items/${detailsFilename}`;
  const archiveContent = `Deleted Product Archive\nID: ${prod.id}\nName: ${prod.name}\nPrice: ${prod.price}\nStatus: ${prod.status}\nDisplayOrder: ${prod.displayOrder}\nDeleted At: ${new Date().toISOString()}`;
  
  try {
    // 1. Archive tracking details into deleted_items/ folder
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: archiveKey,
      Body: Buffer.from(archiveContent, 'utf8'),
      ContentType: 'text/plain'
    }));
    // console.log(`[Background S3 Delete] Archived product to ${archiveKey}`);
    
    // 2. Delete original S3 image and details files
    if (await s3FileExists(bucketName, imageKey)) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: imageKey
      }));
    }
    
    if (await s3FileExists(bucketName, detailsKey)) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: detailsKey
      }));
    }
    
    // console.log(`[Background S3 Delete] Successfully cleaned S3 files for product ${prod.id}`);
  } catch (err) {
    console.error(`[Background S3 Delete Error] Failed for product ${prod.id}:`, err.message);
  }
}

async function migrateS3KeysOnStartup() {
  if (!s3Client || !process.env.AWS_BUCKET_NAME) return;
  // console.log('[Migration] Checking S3 object keys for prefix synchronization...');
  
  // Sort the current cache by displayOrder or index
  const sortedCache = [...productCache].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  for (let index = 0; index < sortedCache.length; index++) {
    const prod = sortedCache[index];
    const targetOrder = index + 1;
    
    // Generate old/current details and image key names if not set
    const sanitizedId = prod.id.toString().replace(/[^0-9a-zA-Z]/g, '').trim();
    
    // Current detailsKey and imageKey in cache
    const currentDetailsKey = prod.detailsKey;
    const currentImageKey = prod.imageKey;

    // Expected new keys based on targetOrder (products/ and images/ folder prefixed layout)
    const targetFilename = generateS3FileName(sanitizedId, prod.name, prod.price, prod.status, targetOrder);
    const targetDetailsKey = `products/${targetFilename}.txt`;
    const targetImageKey = `images/${sanitizedId}.jpg`;

    // Check if details key needs migration
    if (currentDetailsKey && currentDetailsKey !== targetDetailsKey) {
      // console.log(`[Migration] Migrating details key from "${currentDetailsKey}" to "${targetDetailsKey}"`);
      await renameS3Object(currentDetailsKey, targetDetailsKey);
      prod.detailsKey = targetDetailsKey;
    }

    // Check if image key needs migration
    if (currentImageKey && currentImageKey !== targetImageKey) {
      // console.log(`[Migration] Migrating image key from "${currentImageKey}" to "${targetImageKey}"`);
      await renameS3Object(currentImageKey, targetImageKey);
      prod.imageKey = targetImageKey;
      prod.image_url = buildS3PublicUrl(targetImageKey);
      prod.imageUri = buildS3PublicUrl(targetImageKey);
    }

    // Update displayOrder in cache
    prod.displayOrder = targetOrder;
    
    // Update DB in background
    if (dbPool) {
      dbPool.execute(
        'UPDATE products SET display_order = ? WHERE id = ?',
        [targetOrder, parseInt(prod.id, 10)]
      ).catch(e => console.error('[Migration DB Update Error]:', e.message));
    }
  }
  // console.log('[Migration] Prefix synchronization checks complete.');
}

async function initializeProductCache() {
  console.log('Initializing on-memory product cache...');
  const bucketName = process.env.AWS_BUCKET_NAME;

  if (s3Client && bucketName) {
    try {
      console.log('Loading products from S3...');
      const productsList = await scanProductsFromS3();
      productCache = productsList;

      if (productCache.length > 0) {
        console.log(`Loaded ${productCache.length} products from S3 into cache.`);
        migrateS3KeysOnStartup().catch(err => {
          console.error('[Migration Error] Failed key migration:', err.message);
        });
        return;
      }
    } catch (err) {
      console.warn('Failed to load products from S3 on startup:', err.message);
    }
  }

  // Fallback to MySQL DB
  if (dbPool) {
    try {
      console.log('Loading products from MySQL database...');
      const [rows] = await dbPool.execute('SELECT * FROM products');
      productCache = rows.map(r => ({
        id: r.id.toString(),
        name: r.name,
        price: parseFloat(r.price),
        image_url: r.image_url,
        imageUri: r.image_url,
        category: r.category || 'General',
        isAvailable: r.is_available === 1 || r.is_available === true,
        status: (r.is_available === 1 || r.is_available === true) ? 'active' : 'inactive',
        displayOrder: r.display_order || 1
      }));
      console.log(`Loaded ${productCache.length} products from database into cache.`);
    } catch (err) {
      console.error('Failed to load products from database on startup:', err.message);
    }
  }
}


function getCurrentTimeString() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}-${minutes}-${seconds}`;
}

function buildS3PublicUrl(s3Key) {
  // Encode each path segment individually so '/' is preserved but spaces and special chars are escaped
  const encoded = s3Key.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${encoded}`;
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Global server status health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: dbPool ? 'connected' : 'offline',
    aws_s3: s3Client ? 'initialized' : 'failed',
    timestamp: new Date().toISOString()
  });
});

// Endpoint 1: Admin Product Registration
// Method/Route: POST /api/admin/products
// Content-Type: multipart/form-data
app.post('/api/admin/products', upload.single('image'), async (req, res) => {
  // console.log('[POST] /api/admin/products triggered');
  try {
    const { name, price, category } = req.body;
    const file = req.file;

    if (!name || !price) {
      return res.status(400).json({ error: 'Missing required product fields: name and price are required.' });
    }

    if (!file) {
      return res.status(400).json({ error: 'Missing binary image file. An image file must be uploaded.' });
    }

    // Generate sequence-based 5-digit ID counter
    const maxExistingId = productCache.reduce((max, p) => {
      const idNum = parseInt(p.id, 10);
      return !isNaN(idNum) && idNum > max ? idNum : max;
    }, 10000);
    const nextId = Math.max(...productCache.map(p => parseInt(p.id)), 10000) + 1;
    const fiveDigitId = nextId.toString();
    const displayOrder = productCache.length + 1;
    const todayDate = getTodayDateString();

    const filename = generateS3FileName(fiveDigitId, name, price, 'active', displayOrder);
    const s3ImageKey = `images/${fiveDigitId}.jpg`;
    const s3DetailsKey = `products/${filename}.txt`;
    const publicS3Url = buildS3PublicUrl(s3ImageKey);

    const newProd = {
      id: fiveDigitId,
      name,
      price: parseFloat(price),
      image_url: publicS3Url,
      imageUri: publicS3Url,
      category: category || 'General',
      isAvailable: true,
      status: 'active',
      displayOrder: displayOrder,
      detailsKey: s3DetailsKey,
      imageKey: s3ImageKey
    };

    // Update memory cache instantly
    productCache.push(newProd);

    // Sync in background (without await)
    syncProductS3(null, newProd, file);
    if (dbPool) {
      dbPool.execute(
        'INSERT INTO products (id, name, price, image_url, category, is_available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [parseInt(fiveDigitId, 10), name, parseFloat(price), publicS3Url, category || 'General', 1, displayOrder]
      ).catch(e => console.error('[Background DB Insert Error]:', e.message));
    }

    // Respond immediately within 5ms
    return res.status(201).json({
      success: true,
      product: newProd,
      products: getSortedProducts()
    });
  } catch (error) {
    console.error('Error during product registration:', error);
    res.status(500).json({ error: 'Server error registering product.', details: error.message });
  }
});

// Endpoint 2: Client Product Catalog
// Method/Route: GET /api/products
app.get('/api/products', async (req, res) => {
  // console.log('[GET] /api/products triggered (scanning S3 single folder)');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (s3Client && process.env.AWS_BUCKET_NAME) {
    try {
      const productsList = await scanProductsFromS3();
      productCache = productsList;
      return res.json(productsList);
    } catch (err) {
      console.error('Failed to list products from S3 on GET /api/products:', err.message);
    }
  }
  return res.json(getSortedProducts());
});

// Endpoint 2a: Toggle Product Status in S3 (CopyObject + DeleteObject rename)
// Method/Route: POST /api/products/toggle-s3-file
app.post('/api/products/toggle-s3-file', async (req, res) => {
  const { productId } = req.body;
  // console.log(`[POST] /api/products/toggle-s3-file triggered for ID: ${productId}`);

  if (!productId) {
    return res.status(400).json({ error: 'productId is required.' });
  }

  const sanitizedId = productId.toString().replace(/[^0-9a-zA-Z]/g, '').trim();

  const existingIdx = productCache.findIndex(p => p.id.toString().replace(/[^0-9a-zA-Z]/g, '').trim() === sanitizedId);
  if (existingIdx === -1) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  const oldProd = productCache[existingIdx];
  const newAvailable = !oldProd.isAvailable;
  const newStatus = newAvailable ? 'active' : 'inactive';

  let newPublicS3Url = oldProd.image_url;
  let newDetailsKey = oldProd.detailsKey;
  let newImageKey = oldProd.imageKey;

  try {
    const s3Result = await toggleProductStatusS3(oldProd, newStatus);
    newPublicS3Url = s3Result.newPublicS3Url || newPublicS3Url;
    newDetailsKey = s3Result.newDetailsKey || newDetailsKey;
    newImageKey = s3Result.newImageKey || newImageKey;
  } catch (s3Error) {
    console.error(`[S3 Toggle Rename Failure] S3 operations failed:`, s3Error.message);
    return res.status(500).json({ error: 'S3 storage rename failed. Product status toggle aborted.', details: s3Error.message });
  }

  const newProd = {
    ...oldProd,
    isAvailable: newAvailable,
    status: newStatus,
    image_url: newPublicS3Url,
    imageUri: newPublicS3Url,
    detailsKey: newDetailsKey,
    imageKey: newImageKey
  };

  // Update memory cache instantly after AWS promises have successfully resolved
  productCache[existingIdx] = newProd;

  if (dbPool) {
    dbPool.execute(
      'UPDATE products SET is_available = ?, image_url = ? WHERE id = ?',
      [newAvailable ? 1 : 0, newPublicS3Url, parseInt(sanitizedId, 10)]
    ).catch(e => console.error('[Background DB Toggle Error]:', e.message));
  }

  return res.status(200).json({
    success: true,
    productId: sanitizedId,
    isAvailable: newAvailable,
    image_url: newPublicS3Url,
    products: getSortedProducts()
  });
});


// Endpoint 2b: Admin Product Catalog (All Products)
// Method/Route: GET /api/admin/products
app.get('/api/admin/products', (req, res) => {
  // console.log('[GET] /api/admin/products triggered (using on-memory cache)');
  return res.json(getSortedProducts());
});

// Endpoint 3: Delete Product (DELETE /api/admin/products/:id & DELETE /api/products/:id)
const deleteProductHandler = async (req, res) => {
  const productId = req.params.id;
  // console.log(`[DELETE] ${req.path} triggered`);

  const sanitizedId = productId.toString().replace(/[^0-9a-zA-Z]/g, '').trim();

  const existingIdx = productCache.findIndex(p => p.id.toString().replace(/[^0-9a-zA-Z]/g, '').trim() === sanitizedId);
  if (existingIdx === -1) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  const prodToDelete = productCache[existingIdx];

  // Before removing from active operational memory cache, read and update report directly from S3
  const bucketName = process.env.AWS_BUCKET_NAME;
  if (s3Client && bucketName) {
    try {
      const dateToken = new Date().toISOString().split('T')[0];
      const reportKey = `reports/report_${dateToken}.txt`;
      // console.log(`[DELETE] Reading report string directly from S3 using GetObjectCommand for modification: ${reportKey}`);
      const s3Response = await s3Client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: reportKey
      }));
      const fileData = await s3Response.Body.transformToString();
      const lines = fileData.split('\n');
      const updatedLines = lines.map(line => {
        const tokens = line.split('$#$');
        if (tokens.length >= 5 && tokens[1] === sanitizedId) {
          tokens[4] = 'deleted';
          return tokens.join('$#$');
        }
        return line;
      });
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: reportKey,
        Body: Buffer.from(updatedLines.join('\n'), 'utf8'),
        ContentType: 'text/plain'
      }));
      // console.log(`[DELETE] Successfully modified and updated transaction string back to S3 reports/ path`);
    } catch (err) {
      console.warn(`[DELETE] Failed to update daily report on S3:`, err.message);
    }
  }

  // Remove from memory cache instantly
  productCache.splice(existingIdx, 1);

  // Sync in background (without await)
  deleteProductS3Background(prodToDelete);
  if (dbPool) {
    dbPool.execute('DELETE FROM products WHERE id = ?', [parseInt(sanitizedId, 10)])
      .catch(e => console.error('[Background DB Delete Error]:', e.message));
  }

  // Respond immediately within 5ms
  return res.status(200).json({
    success: true,
    message: 'Product successfully deleted.',
    products: getSortedProducts()
  });
};

app.delete('/api/admin/products/:id', deleteProductHandler);
app.delete('/api/products/:id', deleteProductHandler);

// Endpoint 4: Update Product Image & Details (PUT /api/admin/products/:id)
app.put('/api/admin/products/:id', upload.single('image'), async (req, res) => {
  const productId = req.params.id;
  // console.log(`[PUT] /api/admin/products/${productId} triggered`);

  try {
    const { name, price, category } = req.body;
    const file = req.file;

    const sanitizedId = productId.toString().replace(/[^0-9a-zA-Z]/g, '').trim();

    const existingIdx = productCache.findIndex(p => p.id.toString().replace(/[^0-9a-zA-Z]/g, '').trim() === sanitizedId);
    if (existingIdx === -1) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    const oldProd = productCache[existingIdx];

    const updatedName = name || oldProd.name;
    const updatedPrice = price !== undefined ? parseFloat(price) : oldProd.price;
    const updatedCategory = category || oldProd.category;

    const filename = generateS3FileName(sanitizedId, updatedName, updatedPrice, oldProd.status, oldProd.displayOrder);
    const s3ImageKey = `images/${sanitizedId}.jpg`;
    const s3DetailsKey = `products/${filename}.txt`;
    const publicS3Url = buildS3PublicUrl(s3ImageKey);

    const newProd = {
      ...oldProd,
      name: updatedName,
      price: updatedPrice,
      category: updatedCategory,
      image_url: file ? publicS3Url : oldProd.image_url,
      imageUri: file ? publicS3Url : oldProd.imageUri,
      detailsKey: s3DetailsKey,
      imageKey: file ? s3ImageKey : (oldProd.imageKey || s3ImageKey)
    };

    // Update memory cache instantly
    productCache[existingIdx] = newProd;

    // Sync in background (without await)
    syncProductS3(oldProd, newProd, file);
    if (dbPool) {
      dbPool.execute(
        'UPDATE products SET name = ?, price = ?, image_url = ?, category = ? WHERE id = ?',
        [updatedName, updatedPrice, newProd.image_url, updatedCategory, parseInt(sanitizedId, 10)]
      ).catch(e => console.error('[Background DB Update Error]:', e.message));
    }

    // Respond immediately within 5ms
    return res.status(200).json({
      success: true,
      product: newProd,
      products: getSortedProducts()
    });
  } catch (error) {
    console.error('Error during product update:', error);
    res.status(500).json({ error: 'Server error updating product.', details: error.message });
  }
});

// Endpoint 4.5: Toggle Product Status (PATCH /api/admin/products/:id/status)
app.patch('/api/admin/products/:id/status', async (req, res) => {
  const productId = req.params.id;
  // console.log(`[PATCH] /api/admin/products/${productId}/status triggered`);
  try {
    const { isAvailable } = req.body;
    if (isAvailable === undefined) {
      return res.status(400).json({ error: 'isAvailable boolean is required.' });
    }

    const sanitizedId = productId.toString().replace(/[^0-9a-zA-Z]/g, '').trim();

    const existingIdx = productCache.findIndex(p => p.id.toString().replace(/[^0-9a-zA-Z]/g, '').trim() === sanitizedId);
    if (existingIdx === -1) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    const oldProd = productCache[existingIdx];
    const newStatus = isAvailable ? 'active' : 'inactive';

    let newPublicS3Url = oldProd.image_url;
    let newDetailsKey = oldProd.detailsKey;
    let newImageKey = oldProd.imageKey;

    try {
      const s3Result = await toggleProductStatusS3(oldProd, newStatus);
      newPublicS3Url = s3Result.newPublicS3Url || newPublicS3Url;
      newDetailsKey = s3Result.newDetailsKey || newDetailsKey;
      newImageKey = s3Result.newImageKey || newImageKey;
    } catch (s3Error) {
      console.error(`[S3 Toggle Rename Failure] S3 operations failed:`, s3Error.message);
      return res.status(500).json({ error: 'S3 storage rename failed. Product status toggle aborted.', details: s3Error.message });
    }

    const newProd = {
      ...oldProd,
      isAvailable: !!isAvailable,
      status: newStatus,
      image_url: newPublicS3Url,
      imageUri: newPublicS3Url,
      detailsKey: newDetailsKey,
      imageKey: newImageKey
    };

    // Update memory cache instantly after AWS promises have successfully resolved
    productCache[existingIdx] = newProd;

    if (dbPool) {
      dbPool.execute(
        'UPDATE products SET is_available = ?, image_url = ? WHERE id = ?',
        [isAvailable ? 1 : 0, newPublicS3Url, parseInt(sanitizedId, 10)]
      ).catch(e => console.error('[Background DB Status Update Error]:', e.message));
    }

    return res.status(200).json({
      success: true,
      product: newProd,
      products: getSortedProducts()
    });
  } catch (error) {
    console.error('Error toggling status:', error);
    res.status(500).json({ error: 'Server error updating status.', details: error.message });
  }
});


// Endpoint 4.7: Reorder Products (POST /api/products/reorder & /api/admin/products/reorder)
const handleReorderProducts = async (req, res) => {
  // console.log(`[Reorder] POST ${req.path} triggered`);
  try {
    let reorderedProducts = [];
    if (Array.isArray(req.body)) {
      reorderedProducts = req.body;
    } else if (req.body && Array.isArray(req.body.products)) {
      reorderedProducts = req.body.products;
    } else if (req.body && Array.isArray(req.body.productOrder)) {
      reorderedProducts = req.body.productOrder;
    } else {
      return res.status(400).json({ error: 'Reordered list array is required.' });
    }

    reorderedProducts.forEach((item, index) => {
      const newDisplayOrder = index + 1;
      const prodId = String(item.id);
      const cachedProdIdx = productCache.findIndex(p => String(p.id) === prodId);
      if (cachedProdIdx !== -1) {
        const cachedProd = productCache[cachedProdIdx];
        if (cachedProd.displayOrder !== newDisplayOrder) {
          const oldProd = { ...cachedProd };
          cachedProd.displayOrder = newDisplayOrder;

          // Update DB in background
          if (dbPool) {
            dbPool.execute(
              'UPDATE products SET display_order = ? WHERE id = ?',
              [newDisplayOrder, parseInt(cachedProd.id, 10)]
            ).catch(e => console.error('[Background DB Reorder Error]:', e.message));
          }

          // Rename details and image files in S3 in background
          const sanitizedId = cachedProd.id.replace(/[^0-9a-zA-Z]/g, '').trim();
          const oldFilename = generateS3FileName(sanitizedId, oldProd.name, oldProd.price, oldProd.status, oldProd.displayOrder);
          const oldDetailsKey = oldProd.detailsKey || `products/${oldFilename}.txt`;
          const oldImageKey = oldProd.imageKey || `images/${sanitizedId}.jpg`;

          const newFilename = generateS3FileName(sanitizedId, cachedProd.name, cachedProd.price, cachedProd.status, newDisplayOrder);
          const newDetailsKey = `products/${newFilename}.txt`;
          const newImageKey = `images/${sanitizedId}.jpg`;

          // Update cache keys synchronously
          cachedProd.detailsKey = newDetailsKey;
          cachedProd.imageKey = newImageKey;
          cachedProd.image_url = buildS3PublicUrl(newImageKey);
          cachedProd.imageUri = buildS3PublicUrl(newImageKey);

          // Run renames in background without awaiting
          renameS3Object(oldDetailsKey, newDetailsKey);
          renameS3Object(oldImageKey, newImageKey);
        }
      }
    });

    // Respond immediately within 5ms with the updated cache array
    return res.json({
      success: true,
      products: getSortedProducts()
    });
  } catch (error) {
    console.error('Error during reordering:', error);
    res.status(500).json({ error: 'Server error reordering products.', details: error.message });
  }
};

app.post('/api/products/reorder', handleReorderProducts);
app.post('/api/admin/products/reorder', handleReorderProducts);

// Endpoint 5: Place New Order (POST /api/orders/place)
// Goal: Handle conditional routing based on order_type, auto-assign couriers.
app.post('/api/orders/place', async (req, res) => {
  // console.log('[POST] /api/orders/place triggered');
  try {
    const { items, total_price, order_type, seat_number, theatre, mobile } = req.body;
    const orderId = Math.random().toString(36).substr(2, 9);
    
    let status = 'pending';
    let deliveryMan = null;
    
    // Conditional Routing & Status Mapping
    if (order_type === 'counter_pickup') {
      status = 'delivered'; // Bypass Kitchen, complete immediately
      // console.log(`[Routing] Order ${orderId} (Counter Pickup) bypassing Kitchen. Status set to delivered.`);
    } else if (order_type === 'seat_delivery') {
      status = 'pending'; // Send to Kitchen Pending Queue
      
      // Auto-assign Courier
      let deliveryStaff = [];
      if (dbPool) {
        try {
          const [staffRows] = await dbPool.execute('SELECT * FROM staff');
          deliveryStaff = staffRows.filter(s => {
            let roles = [];
            try { roles = typeof s.roles === 'string' ? JSON.parse(s.roles) : (s.roles || []); } catch (e) { roles = s.roles || []; }
            return roles.includes('Delivery') || s.role === 'Delivery';
          });
        } catch (e) {
          console.warn('[Auto-Assign] Failed to fetch staff for auto-assignment:', e.message);
        }
      } else {
        deliveryStaff = mockStaff.filter(s => s.roles && s.roles.includes('Delivery'));
      }

      if (deliveryStaff.length > 0) {
        const randomIndex = Math.floor(Math.random() * deliveryStaff.length);
        deliveryMan = deliveryStaff[randomIndex].name;
      } else {
        deliveryMan = 'Ramesh Kumar'; // Fallback
      }
      // console.log(`[Routing] Order ${orderId} (Seat Delivery to ${seat_number}). Auto-assigned Delivery Man: ${deliveryMan}. status: pending`);
    }

    // Database Insertion
    if (dbPool) {
      await dbPool.execute(
        'INSERT INTO orders (id, total_price, order_type, seat_number, status, items, theatre, delivery_man, mobile) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [orderId, total_price, order_type, seat_number || null, status, JSON.stringify(items), theatre || null, deliveryMan, mobile || null]
      );
      // console.log(`Saved order record ${orderId} inside MySQL database.`);
    } else {
      const newVirtualOrder = {
        id: orderId,
        mobile: mobile || null,
        seat: seat_number || null,
        fulfillmentType: order_type === 'counter_pickup' ? 'Counter Pickup' : 'Seat Delivery',
        items: items || [],
        total: Number(total_price),
        status,
        timestamp: Date.now(),
        theatre: theatre || null,
        deliveryMan
      };
      virtualOrders.push(newVirtualOrder);
      console.warn('[Database Guard] MySQL offline. Virtual order created.');
    }
    
    // Return clean 201 Created response
    return res.status(201).json({ 
      message: 'Order placed successfully', 
      id: orderId, 
      status, 
      deliveryMan 
    });
  } catch (error) {
    console.error('Error during order placement:', error);
    res.status(500).json({ error: 'Server error placing order.', details: error.message });
  }
});

// Endpoint to get all orders
app.get('/api/orders', async (req, res) => {
  try {
    if (dbPool) {
      const [rows] = await dbPool.execute('SELECT * FROM orders ORDER BY created_at DESC');
      const parsedRows = rows.map(r => {
        let items = [];
        try { items = typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []); } catch (e) { items = r.items || []; }
        return {
          id: r.id,
          mobile: r.mobile,
          seat: r.seat_number,
          fulfillmentType: r.order_type === 'counter_pickup' ? 'Counter Pickup' : 'Seat Delivery',
          items,
          total: Number(r.total_price),
          status: r.status,
          timestamp: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
          theatre: r.theatre,
          deliveryMan: r.delivery_man
        };
      });
      res.json(parsedRows);
    } else {
      res.json(virtualOrders);
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Server error fetching orders.', details: error.message });
  }
});

// Endpoint to update an order's status
app.patch('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    if (dbPool) {
      await dbPool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
      const [rows] = await dbPool.execute('SELECT * FROM orders WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      const r = rows[0];
      let items = [];
      try { items = typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []); } catch (e) { items = r.items || []; }
      return res.json({
        id: r.id,
        mobile: r.mobile,
        seat: r.seat_number,
        fulfillmentType: r.order_type === 'counter_pickup' ? 'Counter Pickup' : 'Seat Delivery',
        items,
        total: Number(r.total_price),
        status: r.status,
        timestamp: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        theatre: r.theatre,
        deliveryMan: r.delivery_man
      });
    } else {
      const orderIndex = virtualOrders.findIndex(o => o.id === id);
      if (orderIndex === -1) {
        return res.status(404).json({ error: 'Order not found' });
      }
      virtualOrders[orderIndex].status = status;
      virtualOrders[orderIndex].updatedAt = Date.now();
      return res.json(virtualOrders[orderIndex]);
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Server error updating order status.', details: error.message });
  }
});

// Endpoint to get canteen status
app.get('/api/settings/canteen-status', async (req, res) => {
  try {
    if (dbPool) {
      const [rows] = await dbPool.execute('SELECT value_value FROM settings WHERE key_name = "canteen_status"');
      if (rows.length > 0) {
        return res.json({ isCanteenOpen: rows[0].value_value === 'open' });
      }
      return res.json({ isCanteenOpen: true });
    } else {
      return res.json({ isCanteenOpen: virtualSettings.canteen_status === 'open' });
    }
  } catch (error) {
    console.error('Error fetching canteen status:', error);
    res.status(500).json({ error: 'Server error fetching canteen status.', details: error.message });
  }
});

// Endpoint to update/toggle canteen status
app.post('/api/settings/canteen-status', async (req, res) => {
  const { isCanteenOpen } = req.body;
  const statusStr = isCanteenOpen ? 'open' : 'closed';
  try {
    if (dbPool) {
      await dbPool.execute(
        'INSERT INTO settings (key_name, value_value) VALUES ("canteen_status", ?) ON DUPLICATE KEY UPDATE value_value = ?',
        [statusStr, statusStr]
      );
    } else {
      virtualSettings.canteen_status = statusStr;
    }
    res.json({ success: true, isCanteenOpen });
  } catch (error) {
    console.error('Error updating canteen status:', error);
    res.status(500).json({ error: 'Server error updating canteen status.', details: error.message });
  }
});

// Endpoint to get all staff
app.get('/api/staff', async (req, res) => {
  try {
    if (dbPool) {
      const [rows] = await dbPool.execute('SELECT * FROM staff');
      const parsedRows = rows.map(r => {
        let roles = [];
        let theatres = [];
        try { roles = typeof r.roles === 'string' ? JSON.parse(r.roles) : (r.roles || []); } catch (e) { roles = r.roles || []; }
        try { theatres = typeof r.theatres === 'string' ? JSON.parse(r.theatres) : (r.theatres || []); } catch (e) { theatres = r.theatres || []; }
        return {
          id: r.id,
          name: r.name,
          phone: r.phone,
          role: r.role,
          roles,
          theatres
        };
      });
      res.json(parsedRows);
    } else {
      res.json(mockStaff);
    }
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Server error fetching staff.', details: error.message });
  }
});

// Endpoint to add a new staff member
app.post('/api/admin/staff', async (req, res) => {
  try {
    const { id, name, phone, role, roles, theatres } = req.body;
    if (!name || !phone || !role) {
      return res.status(400).json({ error: 'Missing name, phone, or role' });
    }
    const staffId = id || Math.random().toString(36).substr(2, 9);
    const rolesArr = roles || [role];
    const theatresArr = theatres || [];

    if (dbPool) {
      await dbPool.execute(
        'INSERT INTO staff (id, name, phone, role, roles, theatres) VALUES (?, ?, ?, ?, ?, ?)',
        [staffId, name, phone, role, JSON.stringify(rolesArr), JSON.stringify(theatresArr)]
      );
      await logStaffChange(name, phone, rolesArr, theatresArr);
      res.status(201).json({ id: staffId, name, phone, role, roles: rolesArr, theatres: theatresArr });
    } else {
      const newMember = { id: staffId, name, phone, role, roles: rolesArr, theatres: theatresArr };
      mockStaff.push(newMember);
      await logStaffChange(name, phone, rolesArr, theatresArr);
      res.status(201).json(newMember);
    }
  } catch (error) {
    console.error('Error adding staff:', error);
    res.status(500).json({ error: 'Server error adding staff.', details: error.message });
  }
});

// Endpoint to update a staff member
app.put('/api/admin/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, roles, theatres } = req.body;

    if (dbPool) {
      const [rows] = await dbPool.execute('SELECT * FROM staff WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      const existing = rows[0];
      const updatedName = name !== undefined ? name : existing.name;
      const updatedPhone = phone !== undefined ? phone : existing.phone;
      const updatedRole = role !== undefined ? role : existing.role;
      let updatedRoles = roles;
      if (updatedRoles === undefined) {
        try {
          updatedRoles = typeof existing.roles === 'string' ? JSON.parse(existing.roles) : existing.roles;
        } catch (e) {
          updatedRoles = [existing.role];
        }
      }
      let updatedTheatres = theatres;
      if (updatedTheatres === undefined) {
        try {
          updatedTheatres = typeof existing.theatres === 'string' ? JSON.parse(existing.theatres) : existing.theatres;
        } catch (e) {
          updatedTheatres = [];
        }
      }

      // Check if roles or mobile changed
      let existingRolesArray = [];
      try {
        existingRolesArray = typeof existing.roles === 'string' ? JSON.parse(existing.roles) : existing.roles;
      } catch (e) {
        existingRolesArray = [existing.role];
      }
      
      const phoneChanged = phone !== undefined && phone !== existing.phone;
      const rolesChanged = roles !== undefined && JSON.stringify(roles) !== JSON.stringify(existingRolesArray);

      await dbPool.execute(
        'UPDATE staff SET name = ?, phone = ?, role = ?, roles = ?, theatres = ? WHERE id = ?',
        [updatedName, updatedPhone, updatedRole, JSON.stringify(updatedRoles), JSON.stringify(updatedTheatres), id]
      );

      await logStaffChange(updatedName, updatedPhone, updatedRoles, updatedTheatres);

      res.json({ id, name: updatedName, phone: updatedPhone, role: updatedRole, roles: updatedRoles, theatres: updatedTheatres });
    } else {
      const index = mockStaff.findIndex(s => s.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      const existing = mockStaff[index];
      const updatedName = name !== undefined ? name : existing.name;
      const updatedPhone = phone !== undefined ? phone : existing.phone;
      const updatedRole = role !== undefined ? role : existing.role;
      const updatedRoles = roles !== undefined ? roles : existing.roles;
      const updatedTheatres = theatres !== undefined ? theatres : existing.theatres;

      mockStaff[index] = {
        ...existing,
        name: updatedName,
        phone: updatedPhone,
        role: updatedRole,
        roles: updatedRoles,
        theatres: updatedTheatres
      };

      await logStaffChange(updatedName, updatedPhone, updatedRoles, updatedTheatres);

      res.json(mockStaff[index]);
    }
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ error: 'Server error updating staff.', details: error.message });
  }
});

// Endpoint to delete a staff member
app.delete('/api/admin/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (dbPool) {
      const [rows] = await dbPool.execute('SELECT * FROM staff WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      await dbPool.execute('DELETE FROM staff WHERE id = ?', [id]);
      res.json({ message: 'Staff member deleted successfully', id });
    } else {
      const index = mockStaff.findIndex(s => s.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      mockStaff.splice(index, 1);
      res.json({ message: 'Staff member deleted successfully', id });
    }
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ error: 'Server error deleting staff.', details: error.message });
  }
});

// Endpoint to trigger manual S3 synchronization
app.post('/api/admin/sync-to-s3', async (req, res) => {
  try {
    // console.log('Manual S3 sync triggered via API...');
    const result = await performS3Archiving();
    let reportKey = null;
    try {
      reportKey = await generateDailyReport();
    } catch (repErr) {
      console.error('Failed to generate daily report during manual sync:', repErr.message);
    }
    res.json({
      message: 'S3 archiving completed successfully.',
      reportKey,
      ...result
    });
  } catch (error) {
    console.error('Error in manual S3 sync endpoint:', error);
    res.status(500).json({
      error: 'Failed to complete S3 archiving.',
      details: error.message
    });
  }
});

// Endpoint to manually compile and generate daily report
app.post('/api/admin/reports/daily', async (req, res) => {
  try {
    // console.log('[POST] /api/admin/reports/daily manual report generation triggered');
    const reportKey = await generateDailyReport();
    res.status(200).json({
      success: true,
      message: 'Daily report compiled and stored successfully.',
      key: reportKey
    });
  } catch (error) {
    console.error('Error generating daily report:', error);
    res.status(500).json({
      error: 'Server error generating daily report.',
      details: error.message
    });
  }
});

// Start DB initialization first, then start Express Server
async function startServer() {
  console.log('Initializing database connection...');
  await initDb();
  
  // Load products into memory cache
  await initializeProductCache();

  // Start the automated S3 sync scheduler
  startSyncScheduler();

  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`Canteen backend server running on port ${PORT}`);
    console.log(`==================================================`);
  });
}

startServer();
