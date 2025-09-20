# ApexShare Trainer User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Uploading Training Videos](#uploading-training-videos)
4. [Managing Your Content](#managing-your-content)
5. [Student Access Management](#student-access-management)
6. [Video Settings and Privacy](#video-settings-and-privacy)
7. [Dashboard Features Guide](#dashboard-features-guide)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)
10. [Support and Contact](#support-and-contact)

---

## Introduction

Welcome to ApexShare, the secure video sharing platform designed specifically for motorcycle training instructors. This guide will help you effectively use ApexShare to share training videos with your students in a secure, controlled environment.

### What ApexShare Offers

- **Professional Platform**: Complete web application with trainer and student dashboards
- **Secure Authentication**: Role-based login system for trainers and students
- **Advanced Video Upload**: Chunked upload system supporting files up to 5GB with drag-and-drop interface
- **AWS S3 Integration**: Enterprise-grade storage with 10MB chunk uploads for reliability
- **Trainer Dashboard**: Comprehensive interface for managing training sessions and student access
- **Student Dashboard**: Secure access portal for viewing and downloading assigned videos
- **Automatic Email Notifications**: Professional email templates notify students when videos are ready
- **Mobile-Responsive Design**: Optimized for all devices with touch-friendly interfaces
- **Real-time Progress Tracking**: Live upload progress with speed and time remaining indicators

---

## Getting Started

### System Requirements

**For Uploading:**
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Stable internet connection (minimum 10 Mbps recommended for large files)
- JavaScript enabled

**Supported Video Formats:**
- MP4 (recommended)
- AVI
- MOV
- WMV
- Maximum file size: 5GB
- Maximum duration: No limit

### Accessing ApexShare

1. **Login to Your Account**
   - Open your web browser
   - Navigate to [https://apexshare.be](https://apexshare.be)
   - Click "Login" and enter your trainer credentials
   - **Demo Account Available**: Use `trainer@apexshare.be` with password `demo123` for testing
   - Access your personalized trainer dashboard

2. **Authentication System Status**
   - ✅ **FULLY OPERATIONAL**: Login functionality is working correctly
   - ✅ **API Endpoint**: https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1
   - ✅ **JWT Authentication**: Secure token-based authentication implemented
   - ✅ **Dashboard Access**: Complete trainer dashboard functionality available

3. **Demo Account Information**
   - **Email**: trainer@apexshare.be
   - **Password**: demo123
   - **Role**: Trainer (full dashboard access)
   - **Features**: Complete trainer functionality including video upload and student management

---

## Uploading Training Videos

### Step 1: Prepare Your Video

Before uploading, ensure your video meets these requirements:

**Technical Requirements:**
- File size: Maximum 5GB
- Format: MP4, AVI, MOV, or WMV
- Resolution: Any (1080p recommended for best quality)

**Content Guidelines:**
- Ensure video content is appropriate for educational purposes
- Check video quality and audio clarity
- Verify the video contains the intended training material

### Step 2: Start Upload Process

1. **Access Trainer Dashboard**
   - Login to [https://apexshare.be](https://apexshare.be)
   - Navigate to your trainer dashboard
   - Click "Upload New Video" or "Create Training Session"

2. **Enter Training Session Information**
   - **Student Email**: Enter the student's email address who will receive the video
   - **Video Title**: Give your video a descriptive title (e.g., "Week 1: Basic Controls Training")
   - **Session Description**: Add detailed information about the training content and objectives
   - **Training Notes**: Include any specific instructions or focus areas for the student
   - **Session Date**: Select the date of the training session (optional)

### Step 3: Upload Your Video

**Method 1: Drag and Drop (Recommended)**
1. Drag your video file from your computer
2. Drop it into the large upload area in your dashboard
3. The system will automatically begin chunked upload processing

**Method 2: File Browser**
1. Click "Choose File" or "Browse Files"
2. Navigate to your video file location
3. Select the file and click "Open"
4. Confirm the file selection and metadata

### Step 4: Monitor Upload Progress

- **Advanced Progress Tracking**: Real-time progress bar with chunk-by-chunk upload status
- **Upload Speed**: Live upload speed monitoring (MB/s)
- **Time Remaining**: Accurate time estimation based on current speed
- **File Information**: Complete file details including size, format, and duration
- **Chunk Status**: Visual indication of 10MB chunk upload progress
- **Network Monitoring**: Connection stability and retry status
- **Pause/Resume**: Ability to pause and resume large uploads

### Step 5: Confirm Upload

Once upload reaches 100%:
1. Review all information is correct
2. Click "Complete Upload"
3. Wait for the success confirmation

### Upload Success

After successful upload:
- You'll see a confirmation message
- Student will receive an email notification within 5-10 minutes
- Video will be available for 7 days from upload time

---

## Managing Your Content

### Trainer Dashboard Features

**Training Session Management:**
- View all your uploaded training sessions in a comprehensive dashboard
- Track upload status, processing progress, and student access
- Monitor download analytics and student engagement
- Manage multiple students and training programs simultaneously
- Access detailed session history and metadata

**Video Status Tracking:**
- **Upload Status**: Real-time status of file uploads and processing
- **Student Access**: Track when students access and download videos
- **Analytics Dashboard**: View download statistics and engagement metrics
- **Session History**: Complete record of all training sessions with timestamps
- **Student Management**: Organize students and track their progress

### Understanding Video Lifecycle

**Upload Processing:**
- Chunked uploads process in real-time with immediate feedback
- Small videos (under 100MB): Available instantly after upload
- Large videos (over 1GB): Processed in background, usually ready within 2-5 minutes
- Students receive professional email notifications when processing is complete
- Dashboard shows real-time processing status

**Video Management:**
- Videos stored securely with automatic expiration policies
- Dashboard provides complete visibility into all training sessions
- Student access can be monitored and managed through your trainer interface
- Download analytics provide insights into student engagement

---

## Student Access Management

### Student Dashboard Access

1. **Student Account Creation**:
   - Students receive email invitations to create accounts
   - Secure registration process with email verification
   - Role-based access ensures students only see their assigned content

2. **Dashboard Access**: Students access their personalized dashboard to:
   - View all assigned training videos
   - Track their training progress and completion status
   - Download videos securely through the web interface
   - Access training notes and session information
   - View training history and completed sessions

3. **Email Notifications**: Students receive professional email notifications with:
   - Training session details and objectives
   - Direct link to their student dashboard
   - Video title, description, and training notes
   - Instructions for accessing their secure student portal

### Security Features

**Role-Based Authentication**: Secure login system with trainer and student roles

**JWT Token Security**: Industry-standard authentication with secure session management

**Access Control**: Students can only access videos specifically assigned to them

**Secure Student Accounts**: Each student has a protected account with email verification

**Dashboard Isolation**: Trainers and students have separate, secure dashboard environments

**API Security**: All data transfers protected with enterprise-grade encryption

**Session Management**: Automatic session timeout and secure logout functionality

### Best Practices for Student Communication

**Before Creating Training Sessions:**
- Ensure students have ApexShare accounts or will receive registration invitations
- Explain the dashboard-based access system to students
- Provide your contact information for technical issues
- Share the ApexShare platform URL: https://apexshare.be

**After Uploading:**
- Students receive email notifications about new training sessions
- Include detailed training notes and session objectives in the upload form
- Students can access videos immediately through their secure dashboard
- Monitor student access and engagement through your trainer analytics

---

## Video Settings and Privacy

### Privacy and Security

**Data Protection:**
- All videos are encrypted during upload and storage
- Secure HTTPS connections for all transfers
- AWS enterprise-grade security infrastructure
- Automatic deletion after 7 days

**Access Control:**
- Videos are only accessible via unique, secure links
- No public directory or search functionality
- Links cannot be shared effectively (tied to specific email)

**Email Security:**
- Notifications sent from verified ApexShare domain
- Professional email templates
- No sensitive information in email content

### Content Guidelines

**Appropriate Content:**
- Educational motorcycle training material
- Professional instructional content
- Safety demonstrations and procedures

**Prohibited Content:**
- Personal or non-educational videos
- Copyrighted material without permission
- Inappropriate or offensive content

---

## Dashboard Features Guide

### Trainer Dashboard Overview

Your ApexShare trainer dashboard provides comprehensive tools for managing training sessions, monitoring student progress, and organizing your video content. Access your dashboard at https://apexshare.be after logging in with your trainer credentials.

### Main Dashboard Components

#### 1. Training Sessions Overview
**Location:** Main dashboard page after login
**Features:**
- **Recent Sessions**: View your most recently uploaded training sessions
- **Session Status**: Real-time status of uploads, processing, and student access
- **Quick Stats**: Total sessions, active students, and engagement metrics
- **Quick Actions**: Create new session, bulk operations, and export options

#### 2. Session Management Interface
**Location:** Click "Create Training Session" or "Manage Sessions"
**Features:**
- **Drag-and-Drop Upload**: Large upload area supporting files up to 5GB
- **Chunked Upload Progress**: Real-time progress with 10MB chunk tracking
- **Session Metadata**: Title, description, training notes, and objectives
- **Student Assignment**: Select students and manage access permissions
- **Batch Operations**: Upload multiple videos or assign to multiple students

#### 3. Student Management Dashboard
**Location:** "Students" tab in main navigation
**Features:**
- **Student Directory**: View all registered students and their information
- **Progress Tracking**: Monitor individual student training progress
- **Session History**: Complete history of sessions assigned to each student
- **Communication Tools**: Send messages and notifications to students
- **Performance Analytics**: Download statistics and engagement metrics

#### 4. Analytics and Reporting
**Location:** "Analytics" tab in main navigation
**Features:**
- **Upload Statistics**: Track your video uploads and processing times
- **Download Analytics**: Monitor student download and viewing patterns
- **Engagement Metrics**: View session completion rates and student activity
- **Usage Reports**: Generate reports for training program assessment
- **Export Options**: Download data for external analysis

### Advanced Dashboard Features

#### Video Management Tools
- **Session Library**: Organize and search through all your training sessions
- **Bulk Operations**: Select multiple sessions for batch operations
- **Category Management**: Create categories and tags for better organization
- **Version Control**: Track different versions of training content
- **Archive Management**: Archive completed sessions to reduce clutter

#### Student Interaction Features
- **Assignment Workflow**: Streamlined process for assigning videos to students
- **Progress Monitoring**: Real-time tracking of student viewing and completion
- **Feedback System**: Collect student feedback on training effectiveness
- **Communication Hub**: Direct messaging and announcement features
- **Group Management**: Create student groups for batch assignments

#### Upload Management System
- **Queue Management**: Manage multiple concurrent uploads
- **Resume Capability**: Pause and resume large file uploads
- **Error Recovery**: Automatic retry for failed uploads
- **Processing Status**: Monitor video processing and optimization
- **Quality Settings**: Configure video quality and compression options

### Dashboard Navigation Tips

#### Main Navigation Menu
**Home Dashboard**: Overview of all training activity and quick access to key features
**Create Session**: Direct access to the video upload and session creation interface
**My Sessions**: Complete library of all your training sessions with search and filter options
**Students**: Student management interface with progress tracking and communication tools
**Analytics**: Comprehensive reporting and analytics dashboard
**Settings**: Account settings, preferences, and notification configuration

#### Quick Actions Toolbar
- **+ New Session**: Fast-track to creating a new training session
- **Search**: Global search across all sessions, students, and content
- **Notifications**: View system notifications and student activity alerts
- **Help**: Access to documentation, tutorials, and support resources
- **Account Menu**: Profile settings, password change, and logout options

### Dashboard Customization

#### Personalized Views
- **Dashboard Layout**: Customize widget placement and priority information display
- **Session Filters**: Create saved filters for quick access to specific content
- **Notification Preferences**: Configure email and in-app notification settings
- **Display Options**: Adjust themes, layouts, and accessibility settings

#### Workflow Optimization
- **Favorites**: Mark frequently used features for quick access
- **Recent Items**: Fast access to recently uploaded or accessed content
- **Shortcuts**: Keyboard shortcuts for power users
- **Bulk Templates**: Save common session configurations for reuse

### Mobile Dashboard Experience

#### Responsive Design Features
- **Touch-Optimized Interface**: Mobile-friendly navigation and controls
- **Simplified Upload**: Streamlined upload process for mobile devices
- **Student Communication**: Mobile-optimized messaging and notification system
- **Progress Monitoring**: Real-time tracking accessible from any device
- **Offline Capability**: Cache key information for offline access

### Security and Access Control

#### Dashboard Security Features
- **Session Management**: Secure JWT-based authentication with automatic timeout
- **Role-Based Access**: Trainer-specific permissions and functionality
- **Activity Logging**: Complete audit trail of all dashboard activities
- **Secure Data Transfer**: All dashboard communications encrypted with HTTPS
- **Privacy Controls**: Control what information is shared and visible

---

## Troubleshooting

### Common Upload Issues

**Problem: Upload Fails or Stops**

*Possible Causes:*
- Internet connection interrupted during chunked upload
- File size exceeds 5GB limit
- Unsupported file format
- Authentication session expired
- Browser compatibility issues

*Solutions:*
1. Check your internet connection stability
2. Verify file size and format requirements
3. Login again if session expired
4. Use the pause/resume feature for large files
5. Try uploading during off-peak hours
6. Clear browser cache and cookies
7. Try a different browser (Chrome recommended)
8. Contact support with specific error messages

**Problem: Upload is Very Slow**

*Possible Causes:*
- Large file size
- Slow internet connection
- Network congestion
- Peak usage times

*Solutions:*
1. Check your internet speed (use speedtest.net)
2. Try uploading during off-peak hours
3. Consider reducing video file size
4. Use a wired internet connection instead of WiFi

**Problem: Student Can't Access Training Session**

*Possible Causes:*
- Student doesn't have an ApexShare account
- Email notification in spam/junk folder
- Incorrect email address in training session
- Student login issues
- Browser compatibility problems
- Authentication system errors

*Solutions:*
1. Verify student has created their ApexShare account
2. Check that email address in training session is correct
3. Ask student to check spam/junk folders for registration/notification emails
4. Guide student through account creation at https://apexshare.be
5. **Test with demo account**: Use `student@apexshare.be` / `demo123` to verify system functionality
6. Verify student can login to their dashboard at https://apexshare.be
7. Check trainer dashboard for session delivery status
8. **Verify authentication system**: Confirm API endpoint https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1 is accessible
9. Re-send training session if needed
10. Contact support with student email and session details

### Browser-Specific Issues

**Chrome:**
- Clear browser cache and cookies
- Disable browser extensions temporarily
- Check for Chrome updates

**Firefox:**
- Ensure JavaScript is enabled
- Clear cache and cookies
- Try incognito/private mode

**Safari:**
- Check Safari security settings
- Enable JavaScript and cookies
- Try updating Safari

**Edge:**
- Clear browsing data
- Check privacy settings
- Restart browser

### File Format Issues

**Problem: "Unsupported File Format" Error**

*Solutions:*
1. Convert video to MP4 format (recommended)
2. Use video conversion software like HandBrake (free)
3. Check file extension is correct (.mp4, .avi, .mov, .wmv)

**Recommended Conversion Settings:**
- Format: MP4
- Codec: H.264
- Resolution: 1080p or original
- Bitrate: 5-10 Mbps

---

## Best Practices

### Video Quality Optimization

**Recording Tips:**
- Use good lighting for outdoor training
- Ensure clear audio narration
- Stable camera work (use tripod when possible)
- Record in landscape orientation

**File Size Management:**
- Aim for 1-2GB files for best upload experience
- Use video compression if files are very large
- Consider breaking long sessions into shorter segments

### Upload Timing

**Best Times to Upload:**
- Avoid peak internet usage hours (7-9 PM)
- Upload during business hours when possible
- Allow extra time for large files

**Planning Uploads:**
- Upload videos soon after training sessions
- Don't wait until the last minute
- Test uploads with smaller files first

### Student Communication

**Setting Expectations:**
- Explain the 7-day expiration policy
- Provide clear instructions about downloading
- Include your contact information for questions

**Follow-up:**
- Check with students that they received the video
- Ask if they had any technical difficulties
- Provide additional support as needed

### Organizing Your Training Content

**Dashboard Organization:**
- Use the trainer dashboard to organize sessions by student or training program
- Create logical groupings for different skill levels or training modules
- Utilize the session history and analytics to track student progress
- Set up consistent naming conventions for easy identification

**Session Naming Conventions:**
- Use clear, descriptive titles that indicate skill level and focus area
- Include date or session number for sequential training
- Example: "2025-09-20 - Session 3: Advanced Cornering Techniques"
- Consider using tags or categories for different training types

**Training Notes Best Practices:**
- Include comprehensive learning objectives and expected outcomes
- Note any specific equipment, techniques, or safety considerations
- Add time markers for important sections and key learning moments
- Include preparation instructions or prerequisite knowledge
- Provide follow-up exercises or practice recommendations
- Use the dashboard's rich text formatting for better readability

---

## Support and Contact

### Technical Support

**For Upload Issues:**
- Email: support@apexshare.be
- Include: Description of problem, browser used, file size, error messages, trainer account details
- Use dashboard support chat if available
- Check trainer dashboard for system status updates

**For Student Access Issues:**
- Verify student has ApexShare account and can login
- Check trainer dashboard for session delivery status
- Verify student email address in session details
- Guide student through account creation if needed
- Contact support with trainer and student account information

**For Dashboard Issues:**
- Try logging out and back in
- Clear browser cache and cookies
- Check for browser updates
- Try different browser (Chrome recommended)
- Contact support with specific dashboard functionality issues

### System Status

**Platform Availability:**
- ApexShare is available 24/7
- Planned maintenance notifications will be sent in advance
- Check our status page for any ongoing issues

**Performance Monitoring:**
- Upload speeds are continuously monitored
- Issues are detected and resolved quickly
- Contact support if you experience consistent problems

### Training and Assistance

**Getting Help:**
- This user guide covers most common scenarios
- Video tutorials available on request
- One-on-one training sessions can be arranged
- Email support@apexshare.be for additional assistance

### Feedback and Suggestions

We value your feedback to improve ApexShare:

**How to Provide Feedback:**
- Email: feedback@apexshare.be
- Include specific suggestions or feature requests
- Report any bugs or usability issues

**Feature Requests:**
- Bulk upload capabilities
- Video management dashboard
- Extended expiration options
- Integration with learning management systems

---

## Quick Reference

### Essential Information

- **Platform URL**: https://apexshare.be (Trainer Dashboard Access)
- **API Endpoint**: https://l0hx9zgow8.execute-api.eu-west-1.amazonaws.com/v1 (Fully operational)
- **Authentication Status**: ✅ FULLY OPERATIONAL
- **Demo Trainer Account**: trainer@apexshare.be / demo123
- **Demo Student Account**: student@apexshare.be / demo123
- **Maximum File Size**: 5GB per video file
- **Upload Method**: Chunked uploads (10MB chunks for reliability)
- **Supported Formats**: MP4, AVI, MOV, WMV
- **Authentication**: JWT-based secure login system
- **Student Access**: Dashboard-based with secure accounts
- **Email Notifications**: Professional templates with session details
- **Support Email**: support@apexshare.be

### Training Session Creation Checklist

Before creating each training session, verify:
- [ ] You are logged into your trainer dashboard
- [ ] Video file is under 5GB and in supported format
- [ ] Student has an ApexShare account or will receive registration invitation
- [ ] Student email address is correct and verified
- [ ] Training session title is descriptive and follows naming conventions
- [ ] Training notes include clear objectives and instructions
- [ ] Session metadata (date, duration, focus areas) is complete
- [ ] Internet connection is stable for chunked upload
- [ ] Browser is up to date (Chrome recommended)
- [ ] You have trainer permissions and dashboard access

### Emergency Contacts

**Urgent Technical Issues:**
- Email: urgent@apexshare.be
- Response time: Within 2 hours during business hours

**General Support:**
- Email: support@apexshare.be
- Response time: Within 24 hours

---

*ApexShare Trainer User Guide v2.0 - September 2025*
*Updated for Production Application with Full Dashboard Features*

*For the latest version of this guide and platform access, visit: https://apexshare.be*