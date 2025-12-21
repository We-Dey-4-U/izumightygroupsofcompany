const dns = require("dns").promises;
const ipaddr = require("ipaddr.js");

const ALLOWED_HOSTS = [
  "api.example.com",
  "api.stripe.com"
];

async function isSafeUrl(inputUrl) {
  let url;

  try {
    url = new URL(inputUrl);
  } catch {
    return false;
  }

  // Only allow HTTP/S
  if (!["http:", "https:"].includes(url.protocol)) {
    return false;
  }

  // Host whitelist
  if (!ALLOWED_HOSTS.includes(url.hostname)) {
    return false;
  }

  // Resolve DNS → IP
  const addresses = await dns.lookup(url.hostname, { all: true });

  for (const addr of addresses) {
    const ip = ipaddr.parse(addr.address);

    // Block private, loopback, link-local, and multicast IPs
    if (
      ip.range() !== "unicast" || 
      ip.isPrivate() || 
      ip.isLoopback() ||
      ip.range() === "linkLocal" ||
      ip.range() === "multicast"
    ) {
      return false;
    }
  }

  return true;
}

module.exports = { isSafeUrl };