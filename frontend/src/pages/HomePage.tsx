/**
 * HomePage Component
 *
 * Landing page for ApexShare with modern design and call-to-action.
 * Features responsive design and smooth animations.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Shield, Zap, Users, Check } from 'lucide-react'
import { motion } from 'framer-motion'

export const HomePage: React.FC = () => {
  const features = [
    {
      icon: Shield,
      title: 'Secure Sharing',
      description: 'End-to-end encrypted file sharing with access controls and expiration dates.',
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Optimized for large video files with chunked uploads and global CDN delivery.',
    },
    {
      icon: Users,
      title: 'Easy Collaboration',
      description: 'Share training videos with students and track engagement seamlessly.',
    },
  ]

  const benefits = [
    'Secure file sharing with military-grade encryption',
    'Support for large video files up to 5GB',
    'Mobile-optimized interface for field use',
    'Real-time upload progress and status',
    'Access control and time-limited sharing',
    'Global CDN for fast downloads worldwide',
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="relative bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">🏍️</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">ApexShare</span>
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
                Features
              </a>
              <a href="#benefits" className="text-gray-600 hover:text-gray-900 transition-colors">
                Benefits
              </a>
              <Link
                to="/auth/login"
                className="btn btn-primary"
              >
                Sign In
              </Link>
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Link
                to="/auth/login"
                className="btn btn-primary btn-sm"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900"
            >
              Secure Motorcycle Training
              <span className="text-primary-600 block">Video Sharing</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto"
            >
              Share training videos securely with your students. Upload large files easily,
              control access, and track engagement with our professional platform.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                to="/auth/login"
                className="btn btn-primary btn-lg group"
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>

              <a
                href="#features"
                className="btn btn-secondary btn-lg"
              >
                Learn More
              </a>
            </motion.div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-100 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-200 rounded-full opacity-20 blur-3xl"></div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
              Built for Training Professionals
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Everything you need to share training content effectively and securely
            </p>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="flex justify-center">
                  <div className="p-4 bg-primary-100 rounded-full">
                    <feature.icon className="h-12 w-12 text-primary-600" />
                  </div>
                </div>
                <h3 className="mt-6 text-xl font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="mt-4 text-gray-600">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
                Why Choose ApexShare?
              </h2>
              <p className="mt-4 text-xl text-gray-600">
                Designed specifically for motorcycle training professionals who need
                reliable, secure, and efficient video sharing solutions.
              </p>

              <ul className="mt-8 space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.li
                    key={benefit}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-start space-x-3"
                  >
                    <div className="flex-shrink-0">
                      <Check className="h-6 w-6 text-success-600" />
                    </div>
                    <span className="text-gray-700">{benefit}</span>
                  </motion.li>
                ))}
              </ul>

              <div className="mt-8">
                <Link
                  to="/auth/login"
                  className="btn btn-primary btn-lg"
                >
                  Start Sharing Today
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg shadow-2xl flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">🏍️</span>
                  </div>
                  <h3 className="text-2xl font-bold">Training Video</h3>
                  <p className="text-primary-100">Professional motorcycle instruction</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white">
            Ready to Transform Your Training?
          </h2>
          <p className="mt-4 text-xl text-primary-100">
            Join motorcycle training professionals who trust ApexShare for secure video sharing.
          </p>

          <div className="mt-8">
            <Link
              to="/auth/login"
              className="inline-flex items-center px-8 py-4 bg-white text-primary-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Get Started Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">🏍️</span>
              </div>
              <span className="text-xl font-bold text-white">ApexShare</span>
            </div>

            <div className="mt-4 md:mt-0 text-center md:text-right">
              <p className="text-gray-400">
                © 2025 ApexShare Training. Built with security and performance in mind.
              </p>
              <p className="text-gray-500 text-sm mt-1">
                Powered by AWS • Global Infrastructure
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}