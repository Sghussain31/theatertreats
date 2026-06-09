# App Store Launch Metadata & Console Disclosures

This document provides ready-to-copy answers for the Google Play Store Data Safety form and Apple App Store Privacy details, as well as documentation for Apple Review Guideline 5.1.1(v) compliance regarding account deletion.

---

## 1. Google Play Console — Data Safety Form Answers

| Data Category | Specific Data Type | Collected? | Shared? | Purpose | Link to Account? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Personal Info** | Phone Number | Yes | No | Account management, Authentication, Security verification | Yes |
| **Personal Info** | Name / Username | Yes | No | Account management, Operational labeling (e.g., Courier assignments) | Yes |
| **Financial Info** | Purchase History | Yes | No | App functionality (concession ledger transactions, cashier tracking) | Yes |
| **Location** | Approximate Location | No | No | N/A (seat numbers are collected but not GPS location) | N/A |
| **App Info & Performance** | Diagnostics / Crash Logs | Yes | No | Analytics, Troubleshooting, Debugging | No |

### Data Safety Policy Details:
* **Is data encrypted in transit?** Yes (all API endpoints use HTTPS/TLS).
* **Do you provide a way for users to request that their data be deleted?** Yes (via settings panel in the app or direct contact with Canteen Admins).

---

## 2. Apple App Store Connect — Privacy Details (Nutrition Labels)

When completing the App Privacy section in App Store Connect, configure the declarations as follows:

### Data Collected:
1. **Contact Info (Phone Number & Name)**
   - **Use:** App Functionality, Account Setup, Security.
   - **Linked to User?** Yes.
   - **Tracking Purposes?** No.

2. **Purchases (Purchase History)**
   - **Use:** App Functionality (order logs, sales metrics).
   - **Linked to User?** Yes.
   - **Tracking Purposes?** No.

3. **Diagnostics (Crash Logs & Performance Data)**
   - **Use:** Analytics, Performance diagnostics.
   - **Linked to User?** No.
   - **Tracking Purposes?** No.

---

## 3. Apple App Store Review Guideline 5.1.1(v) — Account Deletion Compliance

### Guideline Requirement:
"If your app supports account creation, you must also offer account deletion within the app."

### "TheaterTreats" Implementation Model:
Because our application is a B2B / enterprise employee workflow tool:
1. **Profile Access:** Staff can log in and view their personal information (Username, mobile number, assigned roles, and bound theaters) on their Profile / Settings modal.
2. **Deletion Workflow:** Since accounts are bound to employment status and theater operational logs, a self-serve immediate account deletion could disrupt active operations (e.g., deleting a courier mid-delivery or removing sales records).
3. **Enterprise Request Portal:** The App provides a dedicated **"Request Account Deletion"** button. 
   - When tapped, the App explains that the request is sent directly to their Canteen Admin.
   - The user confirms the request.
   - The App flags the staff profile as "Deletion Requested" in the system, notifying the theater administrator to disable credentials and archive logs.
4. **App Store Review Response (Pre-written copy to submit in App Review Notes):**
   > "TheaterTreats is an internal, B2B enterprise POS and kitchen display application for authorized staff at our physical theater locations. Employee accounts are created and managed by theater administrators. To satisfy Apple App Store Guideline 5.1.1(v), we have integrated an account deletion request trigger directly within the user's Profile/Settings modal. Staff members can initiate account deletion through the app, which flags the profile for immediate review, disabling credentials, and administrative removal by the theater's Canteen Administrator."
