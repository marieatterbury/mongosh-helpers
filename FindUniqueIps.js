// Run this on a mongod or mongos instance
const connections = db.currentOp(true).inprog;
const uniqueIPs = new Set();

connections.forEach(conn => {
    if (conn.client) {
        // Extract the IP part (before the colon)
        const ip = conn.client.split(":")[0];
        uniqueIPs.add(ip);
    }
});

print("Unique IPs/Hostnames:");
uniqueIPs.forEach(ip => print(ip));
