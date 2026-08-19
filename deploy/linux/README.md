# Déploiement Linux

Bourse.IO peut fonctionner sans service vocal externe. Sous Linux, la voix
off utilise `espeak-ng` par défaut. Pour une voix plus naturelle, installez
Piper et indiquez le chemin de son modèle français dans `.env` :

```dotenv
PIPER_VOICE_PATH=/home/bourseio/.local/share/piper/fr_FR-siwis-medium.onnx
```

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
