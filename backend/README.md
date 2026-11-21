# Backend

Server-side component of **Sajag Kishan** (Team CSITABMC). It exposes the APIs consumed by [farmer-app](../farmer-app) and [officer-web](../officer-web) and manages data storage.

## Responsibilities

- Authentication and role-based access (farmer / officer)
- Crop calendar data by altitude and climate zone
- Weather and disease alert generation
- Crop, land and fertilizer data for the officer map
- REST APIs for the farmer app and officer dashboard

## Suggested Structure

```
backend/
├── src/
│   ├── routes/        # API endpoints
│   ├── controllers/   # Request handlers
│   ├── models/        # Database models
│   ├── middleware/    # Auth, validation, error handling
│   └── config/        # Environment and app configuration
├── tests/
├── .env.example
└── README.md
```
