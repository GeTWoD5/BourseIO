# Déploiement Linux

Après avoir installé les dépendances Node et Playwright, activez le tableau de
bord au démarrage :

```bash
sudo install -m 0644 deploy/linux/bourseio.service /etc/systemd/system/bourseio.service
sudo systemctl daemon-reload
sudo systemctl enable --now bourseio
sudo systemctl status bourseio
```

Le serveur reste volontairement limité à `127.0.0.1:3847`. Accédez-y depuis
VS Code Remote SSH en transférant le port `3847`.
