# TheaterTreats — Official Product Description

This document records the exact operational specifications for the TheaterTreats ecosystem, used as the blueprint for legal policies and compliance.

---

## 1. OFFICIAL APP OVERVIEW & CORE PURPOSE
The App is an enterprise-grade, localized Point of Sale (POS), workflow automation, and order fulfillment platform. It is engineered specifically to streamline food beverage concession operations across multiple distinct theater screens: "35mm Screen Desk" and "70mm Screen Desk". The platform synchronizes frontend cashiers, back-of-house kitchen chefs, and terminal delivery personnel in real-time to manage high-volume transaction bursts during theater intermission windows.

---

## 2. MULTI-ROLE AUTHENTICATION & ACCESS CONTROL HIERARCHY
The application implements a strict Role-Based Access Control (RBAC) matrix. Staff members log in using verified mobile numbers and unique credentials. A single employee can be assigned a single role or multiple overlapping roles dynamically by an administrator (roles can shift daily based on roster schedules). Staff are explicitly restricted to viewing ONLY the functional windows authorized for their active role:

• ADMIN: Holds master privileges over the entire system. Admins can create or modify staff profiles, change employee mobile numbers, adjust role checkmarks, edit active menu item registries, and access a global financial ledger overview. Multiple Admin accounts can coexist with equal security clearance.
• CASHIER: Granted exclusive access to the 'New Order' (POS Terminal) module. Tapping unauthorized administrative or kitchen tabs triggers an immediate access-denied block overlay ("You do not have access to this role. Contact Admin").
• KITCHEN: Configured strictly to view the live 'Kitchen Display Queue'. Kitchen staff monitor incoming orders, track processing time frames, and advance cooking states.
• DELIVERY: Granted access to the 'Delivery Status Tracker' to claim ready orders, view customer seating coordinates, and log successful drop-offs.

---

## 3. MULTI-THEATER STAFFING SEPARATION MATRIX
The system architecture natively supports multi-tenant facility mapping:
• Staff accounts can be locked to a single screen entity (e.g., exclusively operating within "35mm Screen Desk" or exclusively within "70mm Screen Desk").
• Cross-functional staff can be bound to BOTH theater screens simultaneously, allowing them to fluidly switch or handle consolidated order queues depending on foot traffic demands.
• The active role and active theater destination are prominently stamped onto the user's header profile dashboard upon every login session to ensure absolute operational clarity.

---

## 4. HYBRID SPLIT-FULFILLMENT ORDERING ENGINE (POS)
The 'New Order' processing window features a dual-track fulfillment pipeline designed to optimize speed at the counter while serving patrons directly in their auditorium seats:

1. COUNTER PICKUP TRACK: Designed for immediate, over-the-counter handoffs. When items are added to the cart under this flag, the order skips the kitchen entirely. The inventory balances are deducted, the transaction ledger is committed, and the order is marked completed instantly at the counter.
2. SEAT DELIVERY TRACK: Designed for in-auditorium service. Orders require a mandatory seat location coordinate. Upon checkout submission, the items are compiled and broadcasted instantly to the Kitchen Display Queue.
3. CUSTOM OVERRIDE MODE: The cart engine supports item-level customization. A cashier can split a single transaction dynamically—for example, handing a customer a "Cold Drink" immediately at the counter (Counter Pickup), while routing their "Large Popcorn" to the kitchen to be prepared and delivered to their seat later (Seat Delivery).

---

## 5. REVOLUTIONARY GESTURE-DRIVEN KITCHEN QUEUE PIPELINE
To maximize efficiency under high-pressure, fast-paced kitchen conditions, all tactile button layouts are eliminated on the line in favor of fluid, rapid, horizontal swipe gestures:
• STAGE 1 (Confirm Cook): Swiping an incoming pending order card from Left to Right (Right-Swipe) crosses a mechanical threshold to transition the item status from "Pending" to "Cooking/In Progress".
• STAGE 2 (Mark Ready): Once preparation is finished, swiping the active cooking card from Left to Right (Right-Swipe) slides away the entry, updates its database flag to "Ready for Dispatch", and automatically routes it to the Delivery terminal pool.

---

## 6. TRANSIT TRACKING & ASSIGNED DELIVERY ECOSYSTEM
The 'Delivery Status' terminal manages final-mile logistics inside the auditoriums:
• Every active delivery card distinctly maps and displays the name of the specific delivery personnel handling the transit payload (e.g., "Assigned: Ramesh Kumar").
• The interface provides real-time state updates as the courier navigates the theater aisles to locate the customer's matching seat coordinates.

---

## 7. ADMINISTRATIVE MASTER CONFIGURE SYSTEM (DAILY LOCKOUT)
To prevent accidental or unauthorized orders after operating hours, the Admin Portal features a global high-visibility Master Control Toggle:
• DAILY ACTIVATION (ON): Toggling the Master Switch to 'ON' instantly mounts and populates the active menu catalog across all Cashier POS terminals at the start of the business morning.
• TONIGHT LOCKOUT (OFF): When the canteen closes at night, turning the switch 'OFF' unmounts the menu globally from the POS interface. The New Order window gracefully displays a "Canteen Closed - Menu Offline" notice. This preserves the historical date-wise transaction folders and local server storage completely without wiping any backend menu data arrays.
