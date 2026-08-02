# Deploying Ovolyn

Ubuntu with Docker and Compose. Three containers: the bank, the seed services,
and Caddy for TLS. Two volumes outlive the containers — the ledger, and the
Circle CLI's device session, which is the only way to reach an Agent Stack
wallet and cannot be baked into an image.

## 1. Point a name at the box

An A record for the host to the server's public IP. HTTPS is not decoration
here: wallet signing is refused by browsers on an insecure origin, so sign-in
and service listing both need a real certificate. A subdomain of something you
already own works; so does `<anything>.<your-ip-with-dashes>.sslip.io` for free.

## 2. Configure

```bash
git clone https://github.com/gdongxi/ovolyn.git && cd ovolyn
cp .env.example .env
```

Fill in `.env`. `OPERATOR_ALLOWLIST` is what keeps a stranger from spending the
treasury — set it to the wallet address or email you will sign in with.

## 3. Start

```bash
docker compose up -d --build
```

Caddy orders a certificate for every named host the moment it loads the config,
not on the first request — so the DNS record has to resolve before this runs.
Point the name at the box first and confirm it, or Caddy spends its first
minutes failing validation and backing off.

## 4. Log the agent wallet in

The wallet is device-bound, so it has to be authenticated once *on the server*.
The session then lasts 28 days.

```bash
docker compose exec app npx circle wallet login you@example.com --init --testnet
# the reply prints a request id; the code arrives by email
docker compose exec app npx circle wallet login you@example.com \
  --request <request-id> --otp <code> --testnet
docker compose exec app npx circle wallet status
```

## 5. Check it

```bash
curl -s https://YOUR_DOMAIN/api/registry | head
curl -si https://YOUR_DOMAIN/stall/gas-oracle | head -1   # expect 402
curl -si -X POST https://YOUR_DOMAIN/api/policy -d '{}'   # expect 401
```

A `402` from the stall means it is live and quoting. A `401` from the policy
route means the guard is on: reading is public, spending is not.

## Operating notes

- **The session expires.** 28 days from step 4. Re-run it before a demo.
- **The ledger lives in the `data` volume.** `docker compose down` keeps it;
  `down -v` destroys it.
- **Logs**: `docker compose logs -f app` / `stalls`.
- **Updating**: `git pull && docker compose up -d --build`. Volumes survive.
- **Changing the Caddyfile needs the container recreated, not reloaded.** Compose
  binds the file, and a bind to a file is a bind to an inode; `git pull` writes a
  replacement and renames it, so the running container keeps reading the old one.
  `caddy reload` then logs `config is unchanged` and exits happily, and
  `caddy validate` blesses the stale file just as happily. Neither tells you
  anything. Use `docker compose up -d --force-recreate caddy`, and confirm with
  `docker compose exec caddy grep -c <the-new-hostname> /etc/caddy/Caddyfile`.
- **Adding a hostname costs one certificate, not a reissue of the others.** Caddy
  keeps one certificate per name, so a new site block never disturbs a name that
  is already serving. Let the DNS resolve first: the order goes out at config
  load, and Let's Encrypt allows five failed validations per hostname per hour.
