import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import { DEBUG } from '../utils/debug';
import { API_URL } from '../utils/api';
import { getItem, setItem, removeItem } from '../utils/storage';

const MockContext = createContext();

export const useMockContext = () => useContext(MockContext);

export const MockProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { id, name, role }
  const [selectedTheatre, setSelectedTheatre] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [isCanteenOpenLocal, setIsCanteenOpenLocal] = useState(true);
  const isCanteenOpen = isCanteenOpenLocal;

  const setIsCanteenOpen = async (isOpen) => {
    setIsCanteenOpenLocal(isOpen);
    try {
      // if (DEBUG) console.log(`[DEBUG] Syncing canteen status to server: isCanteenOpen = ${isOpen}`);
      await fetch(`${API_URL}/api/settings/canteen-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCanteenOpen: isOpen })
      });
    } catch (error) {
      console.warn('[MockContext] Failed to save canteen status to backend:', error.message);
    }
  };

  const [adminViewMode, setAdminViewMode] = useState('Consolidated');

  // Initialize as empty, will be updated from DB once fetched
  const [products, setProducts] = useState([]);

  const [orders, setOrders] = useState({
    pending: [],
    cooking: [],
    ready: [],
    delivered: []
  });

  const [staff, setStaff] = useState([
    { id: '1', name: 'admin', phone: '1234567890', role: 'Admin', roles: ['Admin'], theatres: ['35mm Screen Desk', '70mm Screen Desk'] },
    { id: '2', name: 'admin2', phone: '1234567891', role: 'Admin', roles: ['Admin'], theatres: ['35mm Screen Desk', '70mm Screen Desk'] },
    { id: '3', name: 'cashier1', phone: '9876543210', role: 'Cashier', roles: ['Cashier'], theatres: ['35mm Screen Desk'] },
    { id: '4', name: 'kitchen1', phone: '5555555555', role: 'Kitchen', roles: ['Kitchen'], theatres: ['70mm Screen Desk'] },
    { id: '5', name: 'delivery1', phone: '1111111111', role: 'Delivery', roles: ['Delivery'], theatres: ['35mm Screen Desk'] },
    { id: '6', name: 'multitasker', phone: '9999999999', role: 'Cashier', roles: ['Cashier', 'Kitchen'], theatres: ['35mm Screen Desk', '70mm Screen Desk'] }
  ]);

  const fetchStaff = async () => {
    try {
      // if (DEBUG) console.log("[DEBUG] Fetching staff from server...", `${API_URL}/api/staff`);
      const response = await fetch(`${API_URL}/api/staff`);
      if (!response.ok) {
        throw new Error('Failed to fetch staff from backend.');
      }
      const data = await response.json();
      // if (DEBUG) console.log(`[DEBUG] Loaded ${data.length} staff from database.`);
      setStaff(data);
      return data;
    } catch (error) {
      console.warn("[MockContext] Failed to load staff from database, using offline staff:", error.message);
      return staff;
    }
  };

  const login = async (username, phone) => {
    if (DEBUG) {
      // console.log(`[DEBUG] Context login called with username: ${username}, phone: ${phone}`);
    }
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanPhone = (phone || '').trim();

    const latestStaff = await fetchStaff();

    const foundStaff = latestStaff.find(
      s => s.name.toLowerCase() === cleanUsername && s.phone === cleanPhone
    );

    if (foundStaff) {
      setUser(foundStaff);
      const defaultRole = (foundStaff.roles && foundStaff.roles[0]) || foundStaff.role || null;
      setActiveRole(defaultRole);
      
      await setItem('user_session', JSON.stringify(foundStaff));
      return true;
    }
    return false;
  };

  const logout = async () => {
    if (DEBUG) {
      // console.log("[DEBUG] Context logout called");
    }
    setUser(null);
    setSelectedTheatre(null);
    setActiveRole(null);
    await removeItem('user_session');
    await removeItem('active_role');
    await removeItem('selected_theatre');
  };

  const addOrder = (newOrder) => {
    if (DEBUG) {
      debugger;
      // console.log("[DEBUG] Context addOrder called with:", newOrder);
    }
    // console.log(`[THEATERTREATS-DEBUG] RECEIVED IN STORE - Order ID: ${newOrder.id}`);
    
    // Assign a delivery man if this is a Seat Delivery and does not have one
    let orderToSave = { ...newOrder };
    if (orderToSave.fulfillmentType === 'Seat Delivery' && !orderToSave.deliveryMan) {
      const deliveryStaff = staff.filter(s => s.roles && s.roles.includes('Delivery'));
      if (deliveryStaff.length > 0) {
        const randomIndex = Math.floor(Math.random() * deliveryStaff.length);
        orderToSave.deliveryMan = deliveryStaff[randomIndex].name;
      } else {
        orderToSave.deliveryMan = 'Ramesh Kumar'; // Fallback
      }
    }

    const status = orderToSave.status || 'pending';
    setOrders(prev => {
      const statusKey = prev[status] ? status : 'pending';
      return {
        ...prev,
        [statusKey]: [...prev[statusKey], orderToSave]
      };
    });
  };

  const moveOrder = async (orderId, fromStatus, toStatus) => {
    if (DEBUG) {
      // console.log(`[DEBUG] Context moveOrder: id=${orderId}, from=${fromStatus}, to=${toStatus}`);
    }
    
    // Optimistic Update
    setOrders(prev => {
      if (!prev[fromStatus]) return prev;
      const orderToMove = prev[fromStatus].find(o => o.id === orderId);
      if (!orderToMove) return prev;
      
      const cleanToStatus = prev[toStatus] ? prev[toStatus].filter(o => o.id !== orderId) : [];
      
      return {
        ...prev,
        [fromStatus]: prev[fromStatus].filter(o => o.id !== orderId),
        [toStatus]: [...cleanToStatus, { ...orderToMove, status: toStatus, updatedAt: Date.now() }]
      };
    });

    // API Dispatch
    try {
      // if (DEBUG) console.log(`[DEBUG] Syncing status update to server: PATCH /api/orders/${orderId}/status (status: ${toStatus})`);
      const response = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStatus })
      });
      if (!response.ok) {
        throw new Error('Server rejected status update');
      }
      const updatedOrder = await response.json();
      // if (DEBUG) console.log('[DEBUG] Status update confirmed by server:', updatedOrder);
      
      // Update local state again with backend-confirmed order representation
      setOrders(prev => {
        if (!prev[toStatus]) return prev;
        return {
          ...prev,
          [toStatus]: prev[toStatus].map(o => o.id === orderId ? { ...o, ...updatedOrder } : o)
        };
      });
    } catch (error) {
      console.warn('[MockContext] Failed to update order status on server. Order will remain updated locally:', error.message);
    }
  };

  const fetchProducts = async () => {
    try {
      // if (DEBUG) console.log("[DEBUG] Fetching products from server...", `${API_URL}/api/products`);
      const response = await fetch(`${API_URL}/api/products?t=${Date.now()}&v=${Math.random()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch products from backend.');
      }
      const data = await response.json();
      // if (DEBUG) console.log(`[DEBUG] Loaded ${data.length} products directly from AWS S3.`);
      setProducts(data);
      return data;
    } catch (error) {
      console.warn("[MockContext] Failed to load products from database, using offline catalog:", error.message);
      return products;
    }
  };

  const fetchOrders = async () => {
    try {
      // if (DEBUG) console.log("[DEBUG] Fetching orders from server...", `${API_URL}/api/orders`);
      const response = await fetch(`${API_URL}/api/orders`);
      if (!response.ok) {
        throw new Error('Failed to fetch orders from backend.');
      }
      const allOrders = await response.json();
      // if (DEBUG) console.log(`[DEBUG] Loaded ${allOrders.length} orders from database.`);
      
      // Group orders by status
      const grouped = {
        pending: [],
        cooking: [],
        ready: [],
        delivered: []
      };
      
      allOrders.forEach(o => {
        const statusKey = grouped[o.status] ? o.status : 'pending';
        grouped[statusKey].push(o);
      });
      
      setOrders(grouped);
      return grouped;
    } catch (error) {
      console.warn("[MockContext] Failed to load orders from database, using local/cached orders:", error.message);
    }
  };

  const fetchCanteenStatus = async () => {
    try {
      // if (DEBUG) console.log("[DEBUG] Fetching canteen status from server...", `${API_URL}/api/settings/canteen-status`);
      const response = await fetch(`${API_URL}/api/settings/canteen-status`);
      if (!response.ok) {
        throw new Error('Failed to fetch canteen status.');
      }
      const data = await response.json();
      // if (DEBUG) console.log(`[DEBUG] Loaded canteen status: isCanteenOpen = ${data.isCanteenOpen}`);
      setIsCanteenOpenLocal(data.isCanteenOpen);
    } catch (error) {
      console.warn("[MockContext] Failed to load canteen status from database:", error.message);
    }
  };

  useEffect(() => {
    const initSession = async () => {
      const latestStaff = await fetchStaff();
      try {
        const cachedUserStr = await getItem('user_session');
        const cachedRole = await getItem('active_role');
        const cachedTheatre = await getItem('selected_theatre');
        
        if (cachedUserStr) {
          const cachedUser = JSON.parse(cachedUserStr);
          const matched = latestStaff.find(
            s => s.name.toLowerCase() === cachedUser.name.toLowerCase() && s.phone === cachedUser.phone
          );
          if (matched) {
            setUser(matched);
            setActiveRole(cachedRole || (matched.roles && matched.roles[0]) || matched.role);
            setSelectedTheatre(cachedTheatre || null);
            // console.log('[Storage Session] Session validated and restored for:', matched.name);
          } else {
            console.warn('[Storage Session] Cached session user not found or phone mismatched. Logging out.');
            await removeItem('user_session');
            await removeItem('active_role');
            await removeItem('selected_theatre');
          }
        }
      } catch (err) {
        console.error('[Storage Session] Failed to initialize session:', err);
      }
    };
    
    fetchOrders();
    fetchCanteenStatus();
    initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    const saveTheatre = async () => {
      if (selectedTheatre) {
        await setItem('selected_theatre', selectedTheatre);
      } else {
        await removeItem('selected_theatre');
      }
    };
    saveTheatre();
  }, [selectedTheatre]);

  useEffect(() => {
    const saveRole = async () => {
      if (activeRole) {
        await setItem('active_role', activeRole);
      } else {
        await removeItem('active_role');
      }
    };
    saveRole();
  }, [activeRole]);

  // Automatic re-fetch intervals removed to trust local/user triggered actions only.


  const addProduct = async (product) => {
    if (DEBUG) {
      debugger;
      // console.log("[DEBUG] Context addProduct called with:", product);
    }
    try {
      const formData = new FormData();
      formData.append('name', product.name);
      formData.append('price', product.price.toString());
      formData.append('category', product.category || 'General');

      // Check if image is a local URI from expo-image-picker
      if (product.imageUri) {
        if (Platform.OS === 'web') {
          // On Web, fetch the local blob or data URL and convert to a real binary Blob
          try {
            const res = await fetch(product.imageUri);
            const blob = await res.blob();
            const filename = product.imageUri.split('?')[0].split('/').pop() || 'product.png';
            formData.append('image', blob, filename);
          } catch (e) {
            console.warn('[MockContext] Failed to parse web image blob:', e);
          }
        } else if (
          product.imageUri.startsWith('file://') || 
          product.imageUri.startsWith('content://') || 
          product.imageUri.startsWith('assets-library://') || 
          !product.imageUri.startsWith('http')
        ) {
          const filename = product.imageUri.split('/').pop() || 'product.png';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/png`;

          // Format for react-native multipart upload (do NOT remove file:// prefix on iOS!)
          const fileObj = {
            uri: product.imageUri,
            name: filename,
            type: type,
          };
          formData.append('image', fileObj);
        }
      }

      let attempts = 0;
      const maxRetries = 3;
      let response;

      while (attempts <= maxRetries) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
        try {
          if (attempts > 0) {
            const delay = Math.pow(2, attempts - 1) * 1000;
            // console.log(`[Context] Retry attempt ${attempts} for product registration in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          // console.log(`[Context] Registering product to backend (Attempt ${attempts + 1}): ${API_URL}/api/admin/products...`);
          response = await fetch(`${API_URL}/api/admin/products`, {
            method: 'POST',
            body: formData,
            headers: {
              // Do NOT set Content-Type header so the browser/native fetch auto-generates multipart boundaries
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          break;
        } catch (error) {
          clearTimeout(timeoutId);
          const isTimeout = error.name === 'AbortError' || error.message.toLowerCase().includes('timeout') || error.code === 'ETIMEOUT';
          if (isTimeout && attempts < maxRetries) {
            attempts++;
          } else {
            throw error;
          }
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server rejected product registration.');
      }

      const result = await response.json();
      // console.log('[Context] Successfully saved product in S3 and DB:', result);
      
      if (result.success && result.products) {
        setProducts(result.products);
        return result.product;
      } else {
        setProducts(prev => [...prev, result]);
        return result;
      }
    } catch (error) {
      console.warn('[Context] S3/DB registration failed:', error.message);
      throw error;
    }
  };

  const toggleProductAvailability = async (productId) => {
    if (DEBUG) {
      // console.log(`[DEBUG] Context toggleProductAvailability: ${productId}`);
    }

    // Find the product to determine new status
    const targetProduct = products.find(p => p.id === productId || p.id === productId.toString());
    if (!targetProduct) {
      console.warn(`[Toggle] Product ${productId} not found in local state.`);
      return;
    }
    const newAvailability = !targetProduct.isAvailable;

    // Step A: Optimistic local UI update
    setProducts(prev => prev.map(p => 
      (p.id === productId || p.id === productId.toString()) 
        ? { ...p, isAvailable: newAvailability, status: newAvailability ? 'active' : 'inactive' } 
        : p
    ));

    // Step B & C: Hit the backend endpoint to rename S3 files
    try {
      // console.log(`[Toggle] Dispatching POST to ${API_URL}/api/products/toggle-s3-file (productId: ${productId})`);
      const response = await fetch(`${API_URL}/api/products/toggle-s3-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server rejected status toggle.');
      }

      const result = await response.json();
      // console.log(`[Toggle] S3 rename confirmed:`, result);
      if (result.success && result.products) {
        setProducts(result.products);
      }
    } catch (error) {
      console.error(`[Toggle] Backend S3 rename failed, rolling back UI:`, error.message);
      // Rollback the optimistic update — restore both isAvailable and status
      setProducts(prev => prev.map(p => 
        (p.id === productId || p.id === productId.toString()) 
          ? { ...p, isAvailable: !newAvailability, status: !newAvailability ? 'active' : 'inactive' } 
          : p
      ));
    }
  };

  const removeProduct = async (productId) => {
    if (DEBUG) {
      debugger;
      // console.log(`[DEBUG] Context removeProduct: ${productId}`);
    }
    try {
      // console.log(`[Context] Deleting product ${productId} from server: ${API_URL}/api/admin/products/${productId}`);
      const response = await fetch(`${API_URL}/api/admin/products/${productId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server rejected product deletion.');
      }
      // console.log('[Context] Successfully deleted product from S3 and database.');
      const result = await response.json();
      if (result.success && result.products) {
        setProducts(result.products);
      } else {
        setProducts(prev => prev.filter(p => p.id !== productId));
      }
    } catch (error) {
      console.warn('[Context] S3/DB deletion failed, clearing locally only:', error.message);
    } finally {
      // Always remove locally so the UI refreshes instantly
      setProducts(prev => prev.filter(p => p.id !== productId));
    }
  };

  const editProduct = async (productId, updatedProduct) => {
    if (DEBUG) {
      debugger;
      // console.log(`[DEBUG] Context editProduct called with ID ${productId}:`, updatedProduct);
    }
    try {
      const formData = new FormData();
      if (updatedProduct.name) formData.append('name', updatedProduct.name);
      if (updatedProduct.price) formData.append('price', updatedProduct.price.toString());
      if (updatedProduct.category) formData.append('category', updatedProduct.category);

      // Check if image is updated (not an http URL from S3)
      if (updatedProduct.imageUri && !updatedProduct.imageUri.startsWith('http')) {
        if (Platform.OS === 'web') {
          try {
            const res = await fetch(updatedProduct.imageUri);
            const blob = await res.blob();
            const filename = updatedProduct.imageUri.split('?')[0].split('/').pop() || 'product.png';
            formData.append('image', blob, filename);
          } catch (e) {
            console.warn('[MockContext] Failed to parse web image blob:', e);
          }
        } else {
          const filename = updatedProduct.imageUri.split('/').pop() || 'product.png';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/png`;
          formData.append('image', {
            uri: updatedProduct.imageUri,
            name: filename,
            type: type,
          });
        }
      }

      // console.log(`[Context] Updating product ${productId} on backend: ${API_URL}/api/admin/products/${productId}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

      let response;
      try {
        response = await fetch(`${API_URL}/api/admin/products/${productId}`, {
          method: 'PUT',
          body: formData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server rejected product update.');
      }

      const result = await response.json();
      // console.log('[Context] Successfully updated product:', result);
      
      if (result.success && result.products) {
        setProducts(result.products);
        return result.product;
      } else {
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...result } : p));
        return result;
      }
    } catch (error) {
      console.warn('[Context] Product update failed:', error.message);
      throw error;
    }
  };

  const reorderProducts = async (reorderedProducts) => {
    try {
      // Optimistic update of local products state
      setProducts(reorderedProducts);

      const response = await fetch(`${API_URL}/api/products/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reorderedProducts),
      });

      if (!response.ok) {
        throw new Error('Reordering failed on server');
      }

      const result = await response.json();
      if (result.success && result.products) {
        setProducts(result.products);
      }
    } catch (error) {
      console.warn('[MockContext] Failed to reorder products on server:', error.message);
    }
  };

  const addStaff = async (newStaff) => {
    if (DEBUG) {
      // console.log("[DEBUG] Context addStaff:", newStaff);
    }
    let staffToAdd = { ...newStaff };
    const roles = staffToAdd.roles || [staffToAdd.role];
    if (roles.includes('Admin') || staffToAdd.role === 'Admin') {
      staffToAdd.theatres = ['35mm Screen Desk', '70mm Screen Desk'];
    }
    
    try {
      const response = await fetch(`${API_URL}/api/admin/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffToAdd)
      });
      if (!response.ok) {
        throw new Error('Failed to create staff member on server');
      }
      const savedStaff = await response.json();
      setStaff(prev => [...prev, savedStaff]);
    } catch (error) {
      console.warn('[Context] Add staff to backend failed, using offline fallback:', error.message);
      setStaff(prev => [...prev, staffToAdd]);
    }
  };

  const removeStaff = async (staffId) => {
    if (DEBUG) {
      // console.log(`[DEBUG] Context removeStaff: ${staffId}`);
    }
    try {
      const response = await fetch(`${API_URL}/api/admin/staff/${staffId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Failed to delete staff member on server');
      }
      setStaff(prev => prev.filter(s => s.id !== staffId));
    } catch (error) {
      console.warn('[Context] Delete staff from backend failed, using offline fallback:', error.message);
      setStaff(prev => prev.filter(s => s.id !== staffId));
    }
  };

  const updateStaffMember = async (staffId, updatedData) => {
    if (DEBUG) {
      // console.log(`[DEBUG] Context updateStaffMember: ${staffId}`, updatedData);
    }
    
    let staffToUpdate = { ...updatedData };
    if (updatedData.roles && (updatedData.roles.includes('Admin') || updatedData.role === 'Admin')) {
      staffToUpdate.theatres = ['35mm Screen Desk', '70mm Screen Desk'];
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/staff/${staffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffToUpdate)
      });
      if (!response.ok) {
        throw new Error('Failed to update staff member on server');
      }
      const savedStaff = await response.json();
      
      setStaff(prev => prev.map(s => s.id === staffId ? savedStaff : s));

      setUser(prevUser => {
        if (prevUser && prevUser.id === staffId) {
          if (savedStaff.roles && !savedStaff.roles.includes(activeRole)) {
            setActiveRole(savedStaff.roles[0] || null);
          }
          return savedStaff;
        }
        return prevUser;
      });
    } catch (error) {
      console.warn('[Context] Update staff on backend failed, using offline fallback:', error.message);
      
      setStaff(prev => prev.map(s => {
        if (s.id === staffId) {
          let merged = { ...s, ...updatedData };
          const roles = merged.roles || [merged.role];
          if (roles.includes('Admin') || merged.role === 'Admin') {
            merged.theatres = ['35mm Screen Desk', '70mm Screen Desk'];
          }
          return merged;
        }
        return s;
      }));
      
      setUser(prevUser => {
        if (prevUser && prevUser.id === staffId) {
          let mergedUser = { ...prevUser, ...updatedData };
          const roles = mergedUser.roles || [mergedUser.role];
          if (roles.includes('Admin') || mergedUser.role === 'Admin') {
            mergedUser.theatres = ['35mm Screen Desk', '70mm Screen Desk'];
          }
          if (updatedData.roles && !updatedData.roles.includes(activeRole)) {
            setActiveRole(updatedData.roles[0] || null);
          }
          return mergedUser;
        }
        return prevUser;
      });
    }
  };

  const toggleStaffRole = async (staffId) => {
    if (DEBUG) {
      // console.log(`[DEBUG] Context toggleStaffRole: ${staffId}`);
    }
    const rolesList = ['Admin', 'Cashier', 'Kitchen', 'Delivery'];
    const member = staff.find(s => s.id === staffId);
    if (!member) return;

    const currentRoles = member.roles || [member.role || 'Staff'];
    const mainRole = currentRoles[0] || 'Staff';
    const nextRole = rolesList[(rolesList.indexOf(mainRole) + 1) % rolesList.length];
    const nextTheatres = nextRole === 'Admin' ? ['35mm Screen Desk', '70mm Screen Desk'] : member.theatres;
    
    await updateStaffMember(staffId, { role: nextRole, roles: [nextRole], theatres: nextTheatres });
  };

  // Inject activeRole dynamically into user.role for backward compatibility
  // Automatically grant global dual-theatre access to Admins in active user state
  const userWithValue = user ? { 
    ...user, 
    role: activeRole || user.role,
    theatres: (activeRole === 'Admin' || user.role === 'Admin') ? ['35mm Screen Desk', '70mm Screen Desk'] : user.theatres
  } : null;

  return (
    <MockContext.Provider value={{
      user: userWithValue, login, logout,
      activeRole, setActiveRole,
      selectedTheatre, setSelectedTheatre,
      products, setProducts, addProduct, removeProduct, editProduct, toggleProductAvailability, fetchProducts, reorderProducts,
      orders, addOrder, moveOrder, fetchOrders,
      staff, addStaff, removeStaff, toggleStaffRole, updateStaffMember,
      isCanteenOpen, setIsCanteenOpen, fetchCanteenStatus,
      adminViewMode, setAdminViewMode
    }}>
      {children}
    </MockContext.Provider>
  );
};
