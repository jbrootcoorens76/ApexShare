# ApexShare Frontend

Modern React frontend for the ApexShare motorcycle training video sharing platform. Built with TypeScript, Tailwind CSS, and optimized for mobile-first responsive design.

## 🚀 Features

- **Secure File Sharing**: End-to-end encrypted uploads and downloads
- **Chunked Uploads**: Support for large video files up to 5GB
- **Mobile Optimized**: Touch-friendly interface with responsive design
- **Real-time Progress**: Upload/download progress tracking with ETA
- **Role-based Access**: Separate interfaces for trainers and students
- **PWA Ready**: Progressive Web App capabilities
- **Accessibility**: WCAG 2.1 AA compliant interface

## 🛠️ Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand for auth, React Query for server state
- **File Uploads**: React Dropzone with chunked S3 uploads
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Notifications**: React Hot Toast

## 📦 Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm test` - Run tests
- `npm run test:ui` - Run tests with UI

## 🌍 Environment Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_ENVIRONMENT` | Deployment environment | `development` |
| `VITE_API_BASE_URL` | Backend API URL | `https://api.apexshare.be` |
| `VITE_AWS_REGION` | AWS region | `eu-west-1` |
| `VITE_DOMAIN` | Application domain | `apexshare.be` |
| `VITE_ENABLE_ANALYTICS` | Enable analytics tracking | `false` |
| `VITE_MAX_FILE_SIZE` | Maximum file size in bytes | `5368709120` |
| `VITE_CHUNK_SIZE` | Upload chunk size in bytes | `10485760` |

## 🏗️ Architecture

### Component Structure
```
src/
├── components/          # Reusable UI components
│   ├── layout/         # Layout components (Header, Sidebar)
│   ├── ui/             # Basic UI components (Button, Input)
│   └── upload/         # File upload components
├── pages/              # Page components
│   ├── auth/           # Authentication pages
│   ├── trainer/        # Trainer-specific pages
│   ├── student/        # Student-specific pages
│   └── shared/         # Shared pages
├── hooks/              # Custom React hooks
├── services/           # API and external services
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── config/             # Configuration files
```

### Key Features

#### File Upload System
- **Chunked Uploads**: Large files are split into chunks for reliable upload
- **Progress Tracking**: Real-time progress with speed and ETA calculations
- **Error Recovery**: Automatic retry with exponential backoff
- **Mobile Optimization**: Adaptive chunk sizes based on network conditions

#### Authentication & Authorization
- **JWT Tokens**: Secure token-based authentication
- **Role-based Access**: Different interfaces for trainers and students
- **Session Persistence**: Automatic login state restoration

#### Responsive Design
- **Mobile-first**: Designed for mobile with desktop enhancements
- **Touch Optimized**: Minimum 44px touch targets
- **Accessibility**: Screen reader support and keyboard navigation

## 🚀 Deployment

### Staging Deployment
```bash
./deploy.sh staging
```

### Production Deployment
```bash
./deploy.sh production
```

The deployment script:
1. Installs dependencies and runs quality checks
2. Builds the application with environment-specific configuration
3. Uploads files to S3 with proper cache headers
4. Invalidates CloudFront cache for immediate updates

### Infrastructure Integration

The frontend is deployed to:
- **S3 Static Website**: Source files with versioning
- **CloudFront CDN**: Global content delivery with caching
- **Route 53**: DNS management with SSL certificates
- **API Gateway**: Backend API integration with CORS

## 🔒 Security Features

- **Content Security Policy**: Strict CSP headers prevent XSS
- **HTTPS Only**: All traffic encrypted with TLS 1.2+
- **JWT Validation**: Client-side token validation
- **CORS Protection**: Proper cross-origin request handling
- **Input Sanitization**: All user inputs are validated and sanitized

## 📱 Mobile Features

- **Progressive Web App**: Installable with offline capabilities
- **Touch Gestures**: Swipe navigation and touch-friendly controls
- **Responsive Images**: Optimized images for different screen sizes
- **Network Awareness**: Adaptive behavior for slow connections
- **Battery Awareness**: Reduced functionality on low battery

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run coverage

# Run tests in watch mode
npm run test:watch
```

## 🎨 Design System

### Colors
- **Primary**: Blue (#2563EB) - Actions and links
- **Success**: Green (#22C55E) - Success states
- **Warning**: Yellow (#F59E0B) - Warnings
- **Error**: Red (#EF4444) - Errors and failures

### Typography
- **Font**: Inter (system fallback: system-ui, sans-serif)
- **Scales**: 12px, 14px, 16px, 18px, 20px, 24px, 30px, 36px

### Spacing
- **Base Unit**: 4px (0.25rem)
- **Scale**: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px

## 🤝 Contributing

1. Follow the existing code style and conventions
2. Write TypeScript with strict type checking
3. Include responsive design for all new components
4. Add accessibility attributes (ARIA labels, roles)
5. Test on mobile devices and slow networks
6. Update documentation for new features

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.

## 🆘 Support

For technical support or questions:
- Check the documentation in `/docs`
- Review the component examples in Storybook
- Contact the development team

---

Built with ❤️ for motorcycle training professionals worldwide.