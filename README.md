# Rust Trader

> A desktop application for tracking vending machines and finding the best deals in Rust servers

Rust Trader is an Electron-based desktop app that connects to your Rust servers via the Rust+ companion app protocol. It displays all vending machines on a server, their locations, and what they're selling - making it easy to find the best prices and search for specific items across the entire server.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- 🔌 **Server Pairing** - Connect to multiple Rust servers using the Rust+ protocol
- 🏪 **Live Vending Data** - View all vending machines and their inventory in real-time
- 🔍 **Advanced Search** - Search by item name, currency type, or shop name
- 📊 **Smart Filtering** - Sort by price, stock, distance, or item name
- 📍 **Distance Calculation** - See how far each shop is from your current position (requires team membership)
- 🎨 **Multiple Themes** - Choose between Rust, Retro CRT, or Modern themes
- 💾 **Local Data Storage** - All credentials and server data stored locally on your machine
- 🔄 **Auto Item Database** - Automatically fetches item names and IDs from Corrosion Hour

## Screenshots

*Add screenshots here showing the app in action*

## How It Works

Rust Trader uses the Rust+ companion app protocol to connect to game servers. It generates FCM (Firebase Cloud Messaging) credentials locally on your machine and listens for pairing notifications when you pair with a server through the official Rust+ mobile app.

Once paired, it can fetch:
- Server information (name, player count, map size)
- Your current position (if you're in a team)
- All vending machine locations and their sell orders
- Real-time stock and pricing data

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [Rust+ Mobile App](https://rust.facepunch.com/companion) - Required for server pairing

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/bzonca/rusttrader.git
   cd rust-trader-electron
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Apply the rustplus.js patch** (automatically done via postinstall)
   
   The app includes a patch for `@liamcottle/rustplus.js` to handle optional fields in the Rust+ protocol. This is automatically applied when you run `npm install`.

4. **Run the app**
   ```bash
   npm start
   ```

## Usage

### First Time Setup

1. **Generate FCM Credentials**
   - On first launch, click "Generate Credentials"
   - This creates local FCM credentials for receiving pairing notifications

2. **Pair a Server**
   - Click "Add Server" or "Pair Your First Server"
   - Click "Start Listening"
   - Open the Rust+ mobile app on your phone
   - Pair with a server (the server must be online and you must be connected to it)
   - The pairing notification will be captured and the server will be added

3. **View Vending Machines**
   - Select a server from the sidebar
   - The app will connect and fetch all vending machine data
   - Use the search and filter tools to find what you're looking for

### Filtering & Searching

- **Search Item** - Find specific items being sold
- **Currency Filter** - Filter by what currency the shop accepts (e.g., Scrap, HQM)
- **Shop Name** - Search for shops by name
- **Sort By** - Sort by item name, price, stock, or distance
- **Hide Out of Stock** - Only show items currently in stock

### Distance Calculation

If you're in a team on the server, Rust Trader can calculate the distance from your current position to each vending machine. This helps you find the nearest shops.

## Project Structure

```
rust-trader-electron/
├── main.js              # Electron main process
├── renderer.js          # UI logic and rendering
├── preload.js          # Secure IPC bridge
├── index.html          # Main UI
├── styles.css          # Modern theme
├── styles-rust.css     # Rust theme
├── styles-retro.css    # Retro CRT theme
├── package.json        # Dependencies and scripts
└── patches/            # rustplus.js patch
```

## Building

To create a distributable package:

```bash
npm install electron-builder --save-dev
```

Add to `package.json`:
```json
"scripts": {
  "build": "electron-builder"
},
"build": {
  "appId": "com.rusttrader.app",
  "productName": "Rust Trader",
  "directories": {
    "output": "dist"
  }
}
```

Then run:
```bash
npm run build
```

## Credits

This project is built on top of the excellent work by:

- **[@liamcottle/rustplus.js](https://github.com/liamcottle/rustplus.js/)** - The Rust+ protocol library that makes this all possible
- **[@liamcottle/push-receiver](https://github.com/liamcottle/push-receiver)** - FCM push notification listener
- **[Corrosion Hour](https://www.corrosionhour.com/)** - Item database for Rust item IDs and names

## Technical Details

### Data Storage

All data is stored locally on your machine in Electron's userData directory:
- `fcm-credentials.json` - Your FCM credentials (never shared)
- `items.json` - Cached item database from Corrosion Hour
- `servers.json` - Your paired servers (automatically created)

### The rustplus.js Patch

The included patch modifies the Protocol Buffer definitions in `rustplus.js` to make certain fields optional instead of required. This handles cases where the Rust+ API doesn't always return all expected fields, preventing parsing errors.

## Security & Privacy

- **Local First**: All credentials and server data are stored locally on your machine
- **No Backend**: This app doesn't connect to any third-party servers except:
  - Your Rust game servers (via the Rust+ protocol)
  - Corrosion Hour (to fetch item database)
  - Firebase Cloud Messaging (for pairing notifications only)
- **Open Source**: All code is available for review

## Known Limitations

- Distance calculation only works if you're in a team on the server
- The app needs to be running when you pair a new server to capture the pairing notification
- Vending machine data is fetched when you select a server (not real-time updates)

## Troubleshooting

### Pairing doesn't work
- Make sure the app is running with "Start Listening" active
- Ensure you're connected to the server in-game when pairing
- Try regenerating your FCM credentials if issues persist

### No vending machines found
- The server might not have any vending machines placed
- Ensure you're properly paired and connected to the server
- Try refreshing the vending data

### Items show as "Unknown Item"
- Click the refresh button to update the item database
- Check your internet connection for accessing Corrosion Hour

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This is an unofficial tool and is not affiliated with, endorsed by, or connected to Facepunch Studios or the official Rust game. Use at your own risk.

---

**Note**: This tool uses the same protocols as the official Rust+ companion app and operates within the public API. It does not modify game files, provide unfair advantages, or violate the game's terms of service.
