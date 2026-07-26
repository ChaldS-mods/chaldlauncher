module.exports = {
  appId: "ru.chaldstudio.launcher.setup",
  productName: "ChaldLauncher Setup",
  directories: {
    output: "dist",
  },
  files: [
    "**/*",
    "!resources/**",
  ],
  extraResources: [
    { from: "resources/app-payload.zip", to: "app-payload.zip" },
  ],
  asar: true,
  win: {
    target: "portable",
  },
}
