# Kalna Liquor Delivery

A hyper-local liquor delivery platform tailored exclusively for Kalna, West Bengal.
Built upon the robust SwadKart microservices architecture, this application complies strictly with local alcohol regulations while providing a seamless ordering experience.

## Overview
This platform connects customers with licensed local liquor shops and dedicated delivery partners.

- **Strict Regulatory Compliance**: Built-in operational hours restrictions (e.g., 10 AM to 10 PM IST).
- **Age Gating & Legal Checks**: End-to-end age verification starting from user profile registration through to mandatory physical ID checks by riders upon delivery.
- **Single-Shop Checkout**: Customers can only checkout from a single licensed shop per order, matching strict regulatory requirements.
- **Geospatial Tracking**: Real-time delivery partner tracking via WebSockets (Socket.io) with precise location and status synchronization.

## Architecture

- **Frontend**: React 19, Tailwind CSS, Redux Toolkit
- **Backend**: Node.js, Express 5.x
- **Database**: MongoDB (Mongoose) with Geospatial queries
- **Payments**: Razorpay secure online transaction processing
- **Real-Time**: Socket.io for order status and ETA tracking

## License
MIT License
