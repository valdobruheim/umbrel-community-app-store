# BCH Dashboard Umbrel App

This UmbrelOS app installs a custom **BCH Dashboardr**.

## Ports
- BCH RPC Explorer: **3015**


## The structure of the project

bch-dashboard/
├── public/
│   └── index.html      # The UI (Umbrel style)
├── server.js           # The Node.js bridge
├── package.json        # Dependencies
├── Dockerfile          # The Build instructions
└── docker-compose.yml  # The Orchestration