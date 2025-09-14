# Revengers Esports Website

A modern, responsive website for Revengers Esports - a football esports team.

## Project Overview

This project is a complete redesign and enhancement of the Revengers Esports website with a focus on:

- Modern, professional design with sleek animations and transitions
- Responsive layout that works on all devices
- Improved user experience with smooth interactions
- Enhanced SEO and social media sharing capabilities
- Production-ready optimizations

## Key Features

### Design Improvements
- **Modern Professional Design**: Implemented a sleek, professional design with gradient backgrounds and subtle animations
- **Responsive Layout**: Fully responsive design that adapts to all screen sizes
- **Enhanced Typography**: Improved typography hierarchy with better readability
- **Consistent Color Scheme**: Professional color scheme with primary blue accents and clean backgrounds
- **Smooth Animations**: Added subtle animations and transitions for better user experience

### Technical Optimizations
- **SEO Enhancements**: Added meta tags for better search engine optimization
- **Social Media Integration**: Open Graph and Twitter Card meta tags for better social sharing
- **Performance Optimizations**: Gzip/Brotli compression and other performance enhancements

### User Experience
- **Improved Navigation**: Enhanced navigation with hover effects and active states
- **Better Forms**: Improved form styling with focus states and validation
- **Loading Indicators**: Added loading indicators for better user feedback
- **Accessibility**: Improved accessibility with proper semantic HTML and ARIA attributes

## File Structure

```
.
├── index.html              # Home page
├── players.html            # Players page
├── managers.html           # Managers page
├── trophies.html           # Trophies page
├── contact.html            # Contact page
├── admin.html              # Admin panel
├── registered-users.html   # Registered users page
├── styles.css              # Main stylesheet
├── script.js               # Main JavaScript file
├── backend/                # Backend files
│   ├── server.js           # Main server file
│   ├── db.js               # Database configuration
│   ├── auth.js             # Authentication routes
│   ├── playerRoutes.js     # Player API routes
│   ├── managerRoutes.js    # Manager API routes
│   ├── trophyRoutes.js     # Trophy API routes
│   ├── contactRoutes.js    # Contact API routes
│   └── cloudinaryConfig.js # Cloudinary configuration
└── public/                 # Public assets
    └── uploads/            # Uploaded images (including default placeholders)
```

## Getting Started

### Prerequisites
- Node.js (version 18.0.0 or higher)
- PostgreSQL database

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Start the development server: `npm run dev`

## Technologies Used
- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Authentication**: Express-session, bcryptjs
- **Image Processing**: Cloudinary, Sharp
- **Logging**: Morgan
- **Compression**: Compression middleware

## License
This project is proprietary to Revengers Esports.

## Contact
For any inquiries, please contact the Revengers Esports team through the contact form on the website.
