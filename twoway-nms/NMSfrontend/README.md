1. Project Overview
This project is a Single Page Application (SPA) developed using React. It primarily interacts with the backend (Spring Boot service) to provide monitoring, data visualization, topology management, and user access control for Internet of Things (IoT) devices. The project adopts a component-based design and utilizes WebSockets for real-time data updates.

2. Directory Structure Description
Below is the structure of the core src directory and functional descriptions of each module:

Plaintext
src/
├── api/                # API request encapsulation modules
├── assets/             # Static assets
├── components/         # Reusable UI components
├── contexts/           # Global state management
├── pages/              # Page-level components
├── utils/              # Shared utility functions
├── App.jsx             # Root component and routing configuration
├── main.jsx            # Application entry point
└── .env                # Environment variables configuration file
2.1 API Modules (/api)
Centralizes the management of all HTTP requests sent to the backend.

When integrating new backend APIs, they should be encapsulated within this folder according to their functionality (e.g., userApi.js, deviceApi.js). This facilitates unified request management and error interception.

2.2 Reusable Components (/components)
This directory is divided into multiple subfolders by function, storing the basic elements that make up the pages.

Dashboard (Dashboard-related)

DeviceHistoryCharts.jsx: Device history data charts. Primarily responsible for rendering historical data and providing versatile layout views integrated with ECharts.

GlobalDashboard.jsx: Global data overview panel.

SpectrumDashboard.jsx: Spectrum signal data display panel.

Layout (Page Layout)

Header.jsx: System top navigation bar.

MainContent.jsx: Container component for the main content area.

Sidebar.jsx: Left sidebar navigation menu.

Topology (Topology and Maps)

DeviceTopology.jsx: Logical or network topology map rendering between device nodes.

Access Control

PrivateRoute.jsx: Route guard component. Used to check if the user is logged in or has sufficient permissions; redirects to the login page if unauthorized.

2.3 Global State Management (/contexts)
DeviceContext.jsx: Utilizes the React Context API to store and manage shared device state data across components, preventing excessive prop drilling.

2.4 Page Views (/pages)
Corresponds to the various main screens in the application.

User (User Management Module)

Login.jsx: System login page.

Register.jsx: New user registration page.

LoginHistory.jsx: Page to view login history records.

UserManagement.jsx: Account and permission management interface for system administrators.

Dashboard (Main Screens)

MainDashboard.jsx: Default entry dashboard after login.

RealTimeDashboard.jsx: Real-time monitoring dashboard, heavily reliant on data pushed via WebSockets to re-render the screen.

2.5 Shared Utilities (/utils)
websocketUtils.js: Encapsulates WebSocket connections, reconnection mechanisms, event listeners, and message sending logic.

1. Environment and Configuration Handover Notes
Environment Variables (.env):

API endpoints for development and production environments.

WebSocket connection addresses.

Keys or configurations for other third-party services.

Package Dependencies:

You must first run npm install or yarn install to install all necessary dependencies.

Running and Building:

Development mode: npm run dev (if using Vite) or npm start (if using Create React App).

Production build: npm run build.