# Privacy Policy

**Last Updated: May 22, 2026**

This Privacy Policy explains how "TheaterTreats" ("we," "us," or "our"), an enterprise canteen workflow automation and point of sale platform, collects, uses, stores, and protects information relating to staff members and operations. 

The application is an internal workflow tool deployed for employees operating at "35mm Screen Desk" and "70mm Screen Desk" theater facilities. By logging in and using the application, you agree to the collection and use of information in accordance with this policy.

---

## 1. Information Collection and Use

To provide secure authentication, order routing, and audit logs, we collect the following types of information:

### A. Personal and Authentication Data
* **Mobile Number:** We collect and verify your mobile number to create your staff account, authenticate logins, and associate your profile with specific security roles.
* **Name / Username:** Used to display staff identity on orders (e.g., assigning a delivery person to a specific seat delivery) and in the staff management directory.
* **Credentials:** Secure passwords or credentials used to authenticate your login sessions.

### B. Operational and Location Coordinates
* **Auditorium Seat Coordinates:** When a cashier processes a "Seat Delivery" order, the customer's theater seat number (e.g., "F12") is collected. This data is used solely to locate patrons for in-theater delivery and is not linked to external location services or GPS.
* **Fulfillment Type & Overrides:** Tracking whether items are designated for Counter Pickup or Seat Delivery.

### C. Transaction and Catalog Data
* **Sales Records:** Order details, item quantities, pricing totals, and transaction timestamps are recorded to maintain financial logs and coordinate kitchen preparation.
* **Product Catalog Details:** Menu names, descriptions, pricing, inventory availability, and product images uploaded to the system.

### D. Device and Log Information
* **Technical Metrics:** Connection logs, browser type, operating system version (Android, iOS, Web), connection timestamps, and backend query latency statistics are logged to ensure system reliability and troubleshoot errors.

---

## 2. Storage, Security, and Architecture

Your data is processed and secured using enterprise-grade cloud architecture:
* **Product Images:** Stored in secure cloud storage buckets (AWS S3) with parameterized access control.
* **Transaction and Staff Records:** Structured and stored in a secure relational database (MySQL) mapped to local deployment servers.
* **Security Controls:** Encryption of data in transit via Secure Socket Layers (SSL/TLS), Role-Based Access Control (RBAC) preventing unauthorized access, and admin-locked management tools.

---

## 3. Data Sharing and Third-Party Disclosures

* **No External Sharing:** We do not sell, rent, trade, or share staff or customer data with third-party advertisers, brokers, or marketing networks.
* **Internal Routing Only:** Data is exclusively shared internally between cashiers, kitchen displays, and delivery couriers to complete orders, and with administrators for daily financial reporting.
* **Service Providers:** Backend services (e.g., AWS S3 and database servers) access data strictly under instructions to maintain operational database functions, with no rights to use data for independent purposes.

---

## 4. User Rights and Data Retention

### A. Data Access and Portability
Staff members can view their active profile details, assigned roles, and bound theaters directly on the app dashboard. Administrators can view, export, or audit all transaction ledgers.

### B. Account Deletion and Modification
* **Admin Controls:** Canteen Administrators have master privileges to update staff mobile numbers, change assigned roles, or permanently delete staff records from the system.
* **Staff Requests:** Employees can request profile deletion or suspension directly through the **Profile & Settings** panel in the mobile app. Once submitted, the request is flagged for review by the Canteen Admin to revoke database credentials.
* **Retention of Financial Logs:** Historical sales records are retained indefinitely under secure archives for accounting, taxation, and audit purposes, and are completely anonymized or decoupled from deleted staff profiles.

---

## 5. Children's Privacy
The application is an internal, enterprise business utility designed for theater staff and concession workers. It is not intended for use by, nor do we knowingly collect personal data from, children under the age of 13.

---

## 6. Updates to This Policy
We may update our Privacy Policy from time to time. We will notify staff of any changes by posting the updated Privacy Policy on this page and updating the "Last Updated" date.

---

## 7. Contact Information
For questions regarding this Privacy Policy or to request manual account deletion, please contact your designated Canteen Administrator or Theater Operations Manager.
