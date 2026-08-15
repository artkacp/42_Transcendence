### Attention 
**This is a long group project. Poor early choices and lack of
team coordination will cost a lot of time. Your project and team
management will strongly impact your results. All team members must
actively participate and contribute to both the mandatory part and
the modules.**

### Product Owner (PO): 
Defines the product vision, prioritizes features, and en-
sures the project meets user needs.

◦ Maintains the product backlog.  
◦ Makes decisions on features and priorities.  
◦ Validates completed work.  
◦ Communicates with stakeholders (evaluators, peers).  

### Project Manager (PM) / Scrum Master:
Facilitates team coordination and removes obstacles.

◦ Organizes team meetings and planning sessions.  
◦ Tracks progress and deadlines.  
◦ Ensures team communication.  
◦ Manages risks and blockers.  

### Technical Lead / Architect:
Oversees technical decisions and architecture.

◦ Defines technical architecture.  
◦ Makes technology stack decisions.  
◦ Ensures code quality and best practices.  
◦ Reviews critical code changes.  

### Developers (all team members):
Implement features and modules.

◦ Write code for assigned features.  
◦ Participate in code reviews.  
◦ Test their implementations.  
◦ Document their work.  

### Mandatory part

#### 2 General requirements

Building an entire project is complicated, and many things can go wrong. To help you,
we will provide a list of general requirements that you must follow. If you don’t follow
them, your project will be rejected.

The requirements are the following:

• The project must be a web application, and requires a frontend, backend, and a
database.  
• Git must be used with clear and meaningful commit messages. 
The repository must show:  
    ◦ Commits from all team members.
    ◦ Clear commit messages describing the changes.
    ◦ Proper work distribution across the team.  
• Deployment must use a containerization solution (Docker, Podman, or equiva-
lent) and run with a single command.  
• Your website must be compatible with the latest stable version of Google Chrome.  
• No warnings or errors should appear in the browser console.  
• The project must include accessible Privacy Policy and Terms of Service pages
with relevant content.  

### Multi-user Support (Mandatory): 
Your website must support multiple users simultaneously. This is a core requirement of the project.  
Users should be able to interact with the application at the same time without conflicts or performance issues. 
This includes:  
• Multiple users can be logged in and active at the same time.  
• Concurrent actions by different users are handled properly.  
• Real-time updates are reflected across all connected users when applicable.  
• No data corruption or race conditions occur with simultaneous user actions.  

### 3 Technical requirements

This section, like the previous one, is mandatory. You will then be able to choose the
modules you want to use in the next chapter.

• A frontend that is clear, responsive, and accessible across all devices.  
• Use a CSS framework or styling solution of your choice (e.g., Tailwind CSS, Bootstrap, Material-UI, Styled Components, etc.).  
• Store credentials (API keys, environment variables, etc.) in a local .env file that is
ignored by Git, and provide an .env.example file.  
• The database must have a clear schema and well-defined relations.  
• Your application must have a basic user management system. Users must be able to sign up and log in securely:

    ◦ At minimum: email and password authentication with proper security (hashed
    passwords, salted, etc.).  
    ◦ Additional authentication methods (OAuth, 2FA, etc.) can be implemented
    via modules.  
• All forms and user inputs must be properly validated in both the frontend and
backend.  
• Any connection to the backend, from a browser, from a script, from an external
API, etc., must use HTTPS. Connections inside the backend itself (e.g., web server
and database, software inside your container(s)) can be without encryption.

## Modules

**Major: Use a framework for both the frontend and backend.** _(2 points)_

    ◦ Use a frontend framework (React, Vue, Angular, Svelte, etc.).
    ◦ Use a backend framework - Django.

**Major: Allow users to interact with other users. The minimum requirements are:** _(2 points)_

    ◦ A basic chat system (send/receive messages between users).
    ◦ A profile system (view user information).
    ◦ A friends system (add/remove friends, see friends list).

**Major: A public API to interact with the database with a secured API key, rate
limiting, documentation, and at least 5 endpoints:** _(2 points)_

    ◦ GET /api/{something}
    ◦ POST /api/{something}
    ◦ PUT /api/{something}
    ◦ DELETE /api/{something}

Minor: A complete notification system for all creation, update, and deletion ac-
tions. _(1 point)_

Minor: Custom-made design system with reusable components, including a proper
color palette, typography, and icons (minimum: 10 reusable components). _(1 point)_

Minor: Implement advanced search functionality with filters, sorting, and pagina-
tion. _(1 point)_

Minor: File upload and management system. _(1 point)_

    ◦ Support multiple file types (images, documents, etc.).  
    ◦ Client-side and server-side validation (type, size, format).  
    ◦ Secure file storage with proper access control.  
    ◦ File preview functionality where applicable.  
    ◦ Progress indicators for uploads.  
    ◦ Ability to delete uploaded files.  

### 3 User Management

**Major: Standard user management and authentication.** _(2 points)_

◦ Users can update their profile information.  
◦ Users can upload an avatar (with a default avatar if none provided).  
◦ Users can add other users as friends and see their online status.  
◦ Users have a profile page displaying their information.  

Minor: User activity analytics and insights dashboard. _(1 point)_

**Major: Monitoring system with Prometheus and Grafana.** _(2 points)_

◦ Set up Prometheus to collect metrics.  
◦ Configure exporters and integrations.  
◦ Create custom Grafana dashboards.  
◦ Set up alerting rules.  
◦ Secure access to Grafana.  

**Major: Advanced analytics dashboard with data visualization.** _(2 points)_

◦ Interactive charts and graphs (line, bar, pie, etc.).  
◦ Real-time data updates.  
◦ Export functionality (PDF, CSV, etc.).  
◦ Customizable date ranges and filters.  

#### Additional

Major: Advanced permissions system: _(2 points)_

◦ View, edit, and delete users (CRUD).  
◦ Roles management (admin, user, guest, moderator, etc.).  
◦ Different views and actions based on user role.  

Minor: Use an ORM for the database. _(1 point)_  
Minor: Implement remote authentication with OAuth 2.0 (Google, GitHub, 42, etc.). _(1 point)_  
Minor: Implement a complete 2FA (Two-Factor Authentication) system for the users. _(1 point)_  

Minor: Support for multiple languages (at least 3 languages). _(1 points)_  

◦ Implement i18n (internationalization) system.  
◦ At least 3 complete language translations.  
◦ Language switcher in the UI.  
◦ All user-facing text must be translatable.  

