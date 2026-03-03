# Product Requirements Document (PRD)

# Project: China Rose Website

## 1. Overview

### 1.1 Purpose

The purpose of this website is to create a cohesive, professional online presence for China Rose that:

* Provides clear information for both restaurant locations
* Drives direct online orders (Pick-Up and Delivery)
* Enables online job applications

The website should prioritize simplicity, mobile usability, and conversion optimization.

---

## 2. Goals & Objectives

### 2.1 Primary Goals

1. Increase direct Pick-Up orders (higher-margin orders via Toast).
2. Provide easy access to Delivery ordering (Uber Eats).
3. Establish brand credibility and professionalism.
4. Streamline hiring through an online job application form.

### 2.2 Success Metrics

* Increase in Toast (Pick-Up) order volume.
* Reduced customer confusion between locations.
* Completed job applications submitted online.
* Mobile usability (majority of traffic expected on mobile).

---

# 3. Site Architecture

## 3.1 Top-Level Navigation

* Home
* Locations

  * W Military Dr
  * SW Military Dr
* Careers

The website must feel cohesive and unified under one brand while clearly separating location-specific information.

---

# 4. Functional Requirements

## 4.1 Homepage

### 4.1.1 Purpose

The homepage serves as the central brand entry point and location selector.

### 4.1.2 Required Sections

1. Hero Section

   * Restaurant name: China Rose
   * Tagline (e.g., Authentic Chinese Cuisine in San Antonio)

2. Two Location Cards
   Each card must include:

   * Location name
   * Full address
   * Click-to-call phone number
   * "Order Pick-Up" button (Toast)
   * "Order Delivery" button (Uber Eats)
   * "View Menu" link

3. Footer

   * Careers link
   * Contact information
   * Copyright

---

## 4.2 Location Pages (2 Pages)

Each location must have its own dedicated page.

### 4.2.1 Required Information Per Location

* Full address
* Phone number (click-to-call enabled)
* Embedded Google Map
* Store hours

### 4.2.2 Ordering Section (Prominent Placement)

* Primary Button: Order Pick-Up (Toast Online Ordering)
* Secondary Button: Order Delivery (Uber Eats)

Pick-Up should be visually prioritized.

### 4.2.3 Digital Menu

Options (in order of preference):

1. Embedded Toast live menu
2. Custom digital menu synced manually
3. PDF menu (least preferred)

Menu must be mobile-friendly and easy to browse by category.

---

# 5. Careers / Job Application Page

## 5.1 Overview

The Careers page must contain an online job application form. It must be legally compliant and avoid collecting sensitive data prematurely.

## 5.2 Application Form Structure

### Section 1: Basic Information

* Last Name
* First Name
* Middle Name
* Preferred Name
* Street Address
* City
* State
* Zip Code
* Telephone Number
* Email Address

### Section 2: Job Interest

* Position Desired
* Wage Desired
* Available Start Date
* Referred By
* Friends/Relatives Working Here? (If yes, whom?)
* Have you worked here before? (Yes/No)
* Preferred Location (W Military / SW Military)

### Section 3: Eligibility

* Are you 16 years or older? (Yes/No)
* Are you legally authorized to work in the United States? (Yes/No)
* If hired, can you provide proof of eligibility? (Yes/No)

Note: Social Security Number, Alien Registration Number, and Work Permit Numbers must NOT be collected at this stage.

### Section 4: Education History

For each institution:

* School Name
* City
* State
* Major
* Years Attended
* Degree Earned
* Last Year Attended

### Section 5: Work History

For each previous employer:

* Employer Name
* Position Title
* Start Date
* End Date
* Duties
* Reason for Leaving
* Supervisor Name

### Section 6: Military Service (Optional)

* Branch
* Title/Rank
* Duties
* Dates Served
* Reason for Leaving
* Immediate Supervisor

### Section 7: Legal Disclosure

* Have you ever been convicted of a felony? (Yes/No)

  * If yes, optional explanation field

Include standard Equal Employment Opportunity (EEO) statement.

---

# 6. Non-Functional Requirements

## 6.1 Design Requirements

* Mobile-first responsive design
* Clean, minimal interface
* Fast loading speed
* Clear call-to-action buttons

## 6.2 Technical Requirements

* Secure HTTPS hosting
* Form submissions securely stored or emailed
* Spam protection (reCAPTCHA or equivalent)
* Basic SEO optimization

## 6.3 Compliance Requirements

* ADA accessibility considerations
* Avoid pre-offer medical inquiries
* Avoid collecting sensitive identification data during application

---

# 7. Out of Scope (Phase 1)

* Loyalty program
* Online payment processing (handled by Toast and Uber Eats)
* Account creation for customers
* Advanced analytics dashboard

---

# 8. Future Enhancements (Phase 2+)

* Online catering inquiry form
* Promotions page
* Photo gallery
* Reviews integration
* Multi-language support

---

# 9. Summary

The China Rose website will be a unified, brand-focused website with:

1. Dedicated pages for both restaurant locations
2. Clear ordering pathways (Pick-Up prioritized)
3. A compliant and structured online job application

The primary objective is to increase direct ordering revenue while maintaining operational simplicity and professionalism.
