1. Project Overview
This project is an IoT management backend built on Spring Boot. The system is primarily responsible for integrating with the ChirpStack server, synchronizing device status and gateway data, handling bi-directional communication (gRPC and MQTT), and providing Data APIs for the frontend (React). It also features real-time device alert notifications via a Telegram Bot.

2. Core Technologies & Dependencies
Backend Framework: Spring Boot (Java 17)

Build Tool: Maven (pom.xml)

Security & Authentication: Spring Security + JWT (JSON Web Token)

Protocols: RESTful API, WebSocket, gRPC (for ChirpStack communication), MQTT (for device data subscription)

Database ORM: Spring Data JPA

Deployment: Supports Docker containerization (Dockerfile, docker-compose.yml)

3. System Directory & Module Architecture
The core source code is located in src/main/java/com/example/demo/.

3.1 System Configuration (config/)
This layer handles external service connections and security configurations during system startup:

ChirpStackConfig.java: Configures gRPC connections to the ChirpStack server.

MqttReceiverConfig.java: Configures MQTT subscriptions to receive device Uplink data.

SecurityConfig.java: Basic Spring Security settings and CORS/route permission management.

WebSocketConfig.java: Establishes WebSocket channels for real-time data pushing to the frontend.

DataInitializer.java: Handles the writing of foundational data (e.g., default users or configurations) upon startup.

3.2 External API Endpoints (controller/)
Responsible for receiving frontend requests and returning data:

AuthController.java & UserController.java: Handles account registration, standard login, and third-party authorization logic.

DashboardController.java: Supplies aggregated data and statistical charts for the dashboard.

IotController.java: Provides RESTful interfaces for Device and Gateway operations.

3.3 Core Business Logic (service/)
The central processing hub of the system, containing several key services:

Authentication & Authorization: LocalAuthService, GoogleAuthService, FacebookAuthService, and LineAuthService handle login verification for different channels.

ChirpStack Integration:

ApplicationService, DeviceService, GatewayService: Handle CRUD operations for corresponding resources on ChirpStack.

SystemStartupSync.java: Synchronizes the latest status from ChirpStack back to the local database during system startup.

Payload Decoding: DevicePayloadDecoder and CobsCodec process Raw Payloads returned by devices and perform binary decoding for custom command formats (e.g., COBS algorithm).

Monitoring & Alerts:

MonitoringService: Responsible for health monitoring of devices and system status.

TelegramAlertIntegrationService: Links the alert system to a Telegram Bot to broadcast alerts to groups or administrators when triggers are met.

3.4 Data Access & Entities (repository/ & model/)
Model (Entities): Includes device entities (DeviceEntity, GatewayEntity), status logs (DeviceStatusLog, DeviceSpectrumLog, RawPayloadLog), and user/system logs (User, LoginLog, DeviceConfigLog).

Repository: Inherits from JpaRepository to perform database Read/Write operations.

3.5 Security Implementation (security/)
JwtUtils.java: Handles the generation and parsing of JWTs.

JwtAuthenticationFilter.java: Intercepts every HTTP Request to verify if the Token in the Header is valid.

UserDetailsServiceImpl.java: Implements Spring Security logic for user lookup and permission loading.

3.6 Data Transfer Objects (dto/)
Defines the transmission formats for the API to hide the underlying database structure:

Examples: ChartDataDTO for frontend charts, GatewayMetricsResponseDTO, DeviceDetailResponseDto, etc.

3.7 Resources & Protobuf (resources/ & proto/)
proto/: Contains gRPC definition files for communicating with ChirpStack.

Note (wrong_version_proto/): There is a directory named wrong_version_proto under resources containing outdated or incorrect versions of ChirpStack API definitions (e.g., api, common, gw, integration). Please ensure the correct path is used during maintenance or compilation.

application.properties: System environment variables (including DB connections, MQTT addresses, and various API Keys).

4. External Dependencies List
Ensure the following permissions and connection statuses are transferred:

ChirpStack Host: gRPC IP/Port and API Token.

MQTT Broker: Connection IP, Port, Credentials, and Topic subscription rules.

Telegram Bot: Bot Token and Chat ID for alert broadcasting.

OAuth Platforms: Client IDs and Secrets from Google Cloud Console, LINE Developers, and Facebook Developers.

5. Run & Startup Methods
Environment Variable Check: Ensure parameters in application.properties are correctly set before startup.

Local Development: Execute ./mvnw compile followed by ./mvnw spring-boot:run via command line, or run Application.java directly through an IDE.

Containerized Deployment: The project includes a docker-compose.yml. Use docker-compose up -d to build the complete environment.