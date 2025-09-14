# Revengers Esports Website

A modern, responsive website for Revengers Esports - a football esports team. Built with Node.js, Express, and PostgreSQL, optimized for deployment on Render's free tier.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Render](https://img.shields.io/badge/deploy-render-46e3b7.svg)](https://render.com/)

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- PostgreSQL database (or use Render's managed PostgreSQL)
- Cloudinary account for image storage

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/revengers-esports.git
   cd revengers-esports
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Run deployment setup check**
   ```bash
   npm run deploy:setup
   ```

## 🌟 Features

### 🎨 Design & UX
- **Modern Professional Design**: Sleek interface with gradient backgrounds and smooth animations
- **Fully Responsive**: Optimized for all device sizes from mobile to desktop
- **Enhanced Typography**: Improved readability with consistent hierarchy
- **Smooth Animations**: Subtle transitions for better user experience
- **Accessibility**: Semantic HTML and ARIA attributes for screen readers

### 🔒 Security
- **Authentication**: Secure admin login with bcrypt password hashing
- **Session Management**: PostgreSQL-backed sessions with secure cookies
- **Rate Limiting**: Protection against brute force and DDoS attacks
- **Input Validation**: Comprehensive validation using Joi and express-validator
- **Security Headers**: Helmet.js for security headers and CSP
- **CSRF Protection**: Custom double-submit cookie implementation

### ⚡ Performance
- **Image Optimization**: Sharp and Cloudinary for automatic WebP conversion
- **Compression**: Gzip/Brotli compression for all responses
- **Caching**: Smart caching strategies for static assets
- **Database Optimization**: Connection pooling and indexed queries
- **CDN Integration**: Cloudinary CDN for global image delivery

### 🛠 Developer Experience
- **TypeScript-like Validation**: Joi schemas for runtime type checking
- **Comprehensive Testing**: Jest test suite with high coverage
- **Code Quality**: ESLint + Prettier for consistent code style
- **Logging**: Winston for structured logging and monitoring
- **Error Handling**: Comprehensive error handling and reporting

### 📱 Production Ready
- **Health Checks**: Built-in health monitoring endpoints
- **Graceful Shutdown**: Proper cleanup on process termination
- **Environment Configuration**: Centralized config management
- **Database Migration**: Automatic schema setup and migration
- **Monitoring**: Performance and security event logging

## 🏗 Architecture

### Technology Stack
- **Backend**: Node.js 18+, Express.js
- **Database**: PostgreSQL with connection pooling
- **Authentication**: Express-session + bcryptjs
- **File Storage**: Cloudinary for images
- **Image Processing**: Sharp for optimization
- **Validation**: Joi + express-validator
- **Logging**: Winston with multiple transports
- **Testing**: Jest + Supertest
- **Code Quality**: ESLint + Prettier

### Project Structure
```
.
├── backend/                 # Backend application
│   ├── server.js            # Main server file
│   ├── config.js            # Configuration management
│   ├── logger.js            # Logging system
│   ├── db.js                # Database connection and operations
│   ├── auth.js              # Authentication routes
│   ├── validators.js        # Input validation schemas
│   ├── utils.js             # Utility functions
│   ├── playerRoutes.js      # Player management API
│   ├── managerRoutes.js     # Manager management API
│   ├── trophyRoutes.js      # Trophy management API
│   ├── contactRoutes.js     # Contact form API
│   └── cloudinaryConfig.js  # Image upload configuration
├── tests/                   # Test suite
│   ├── setup.js            # Test configuration
│   ├── config.test.js      # Configuration tests
│   └── auth.test.js        # Authentication tests
├── scripts/                 # Utility scripts
│   └── deploy-setup.js     # Deployment setup checker
├── frontend files/          # Static frontend files
│   ├── index.html          # Home page
│   ├── players.html        # Players page
│   ├── managers.html       # Managers page
│   ├── trophies.html       # Trophies page
│   ├── contact.html        # Contact page
│   ├── admin.html          # Admin panel
│   ├── styles.css          # Main stylesheet
│   └── script.js           # Frontend JavaScript
├── .env.example            # Environment variables template
├── render.yaml             # Render deployment configuration
└── package.json            # Dependencies and scripts
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Application
NODE_ENV=development
PORT=3000

# Database (Required)
DATABASE_URL=postgresql://username:password@hostname:port/database

# Security (Required)
SESSION_SECRET=your_super_secure_64_character_secret

# Cloudinary (Required for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Optional Configuration
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=secure_password
PRODUCTION_URL=https://your-app.onrender.com
```

### Database Schema

The application automatically creates the following tables:
- `admins` - Admin user accounts
- `players` - Player information and stats
- `managers` - Team managers
- `trophies` - Achievement records
- `contact_submissions` - Contact form submissions
- `sessions` - User session data

## 🚀 Deployment

### Render Deployment (Recommended)

1. **Prepare for deployment**
   ```bash
   npm run deploy:setup
   ```

2. **Create Render services**
   - Web Service: Connect your GitHub repository
   - PostgreSQL: Create managed database

3. **Configure environment variables in Render dashboard**
   - Use the output from `deploy:setup` script
   - Copy `DATABASE_URL` from your PostgreSQL service

4. **Deploy**
   - Render will automatically deploy on git push to main branch
   - Database schema will initialize automatically

See the [Render Configuration Guide](#render-configuration) below for detailed setup instructions.

### Manual Deployment

1. **Prepare production build**
   ```bash
   npm run deploy
   ```

2. **Set production environment variables**

3. **Start the application**
   ```bash
   npm start
   ```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage
The project maintains high test coverage for:
- Configuration management
- Authentication system
- Input validation
- Database operations
- API endpoints

## 🛠 Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run setup        # Initial project setup

# Testing
npm test             # Run test suite
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors automatically
npm run format       # Format code with Prettier
npm run format:check # Check code formatting

# Deployment
npm run deploy:setup # Check deployment readiness
npm run deploy       # Prepare for deployment
npm run security:check # Run security audit
```

### Code Quality Standards

- **ESLint**: Enforces code quality and security best practices
- **Prettier**: Maintains consistent code formatting
- **Jest**: Comprehensive testing framework
- **Security**: Regular dependency audits and vulnerability scanning

## 📊 Monitoring

### Health Checks
- **Endpoint**: `GET /health`
- **Response**: Application status, uptime, and system metrics
- **Monitoring**: Use with UptimeRobot, Pingdom, or similar services

### Logging
- **Development**: Console output with colors
- **Production**: File-based logging with rotation
- **Security Events**: Dedicated security event logging
- **Performance**: Request timing and slow query detection

## 🔐 Security

### Security Features
- Password hashing with bcrypt (12 rounds)
- Secure session management
- Rate limiting (100 req/15min general, 5 req/15min auth)
- Input validation and sanitization
- Security headers (Helmet.js)
- CSRF protection
- SQL injection prevention
- File upload security

### Security Best Practices
- Regular dependency updates
- Environment variable validation
- Comprehensive error handling
- Audit logging for admin actions
- Secure cookie configuration

## 🆘 Troubleshooting

### Common Issues

**Database Connection Issues**
```bash
# Check database configuration
npm run deploy:setup

# Verify DATABASE_URL format
echo $DATABASE_URL
```

**Image Upload Issues**
```bash
# Verify Cloudinary configuration
echo $CLOUDINARY_CLOUD_NAME
echo $CLOUDINARY_API_KEY
```

**Session Issues**
```bash
# Check session secret
echo $SESSION_SECRET

# Verify session store
curl http://localhost:3000/api/admin/status
```

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/admin/login` - Admin login
- `POST /api/admin/logout` - Admin logout  
- `GET /api/admin/status` - Check authentication status

### Content Management
- `GET /api/players` - List players
- `POST /api/players` - Add player (auth required)
- `PUT /api/players/:id` - Update player (auth required)
- `DELETE /api/players/:id` - Delete player (auth required)

### Contact Management
- `POST /api/contact` - Submit contact form
- `GET /api/registered-users` - List submissions (auth required)

### System
- `GET /health` - Application health check
- `GET /api/csrf-token` - Get CSRF token

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Run linting (`npm run lint`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Guidelines
- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Ensure all checks pass before submitting PR

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Render** for reliable hosting platform
- **Cloudinary** for image management and CDN
- **PostgreSQL** for robust database functionality
- **Express.js** community for excellent middleware ecosystem

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/revengers-esports/issues)
- **Documentation**: This README and inline code comments
- **Contact**: Through the website contact form

---

**Made with ❤️ for the Revengers Esports Team**
