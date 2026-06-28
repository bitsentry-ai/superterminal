export interface DesktopMenuItem {
  label?: string
  accelerator?: string
  type?: 'separator'
  selector?: string
  submenu?: DesktopMenuItem[]
  click?: () => void
}

export interface BuildDesktopMenuTemplateOptions {
  platform: NodeJS.Platform
  isDevelopment: boolean
  productName: string
  actions: {
    quit(): void
    reload(): void
    toggleFullScreen(): void
    toggleDeveloperTools(): void
    closeWindow(): void
    openExternal(url: string): void
  }
}

export function buildDesktopMenuTemplate(
  options: BuildDesktopMenuTemplateOptions,
): DesktopMenuItem[] {
  if (options.platform === 'darwin') {
    return buildDarwinTemplate(options)
  }

  return buildDefaultTemplate(options)
}

function buildDarwinTemplate(
  options: BuildDesktopMenuTemplateOptions,
): DesktopMenuItem[] {
  const aboutMenu: DesktopMenuItem = {
    label: options.productName,
    submenu: [
      {
        label: `About ${options.productName}`,
        selector: 'orderFrontStandardAboutPanel:',
      },
      { type: 'separator' },
      { label: 'Services', submenu: [] },
      { type: 'separator' },
      {
        label: `Hide ${options.productName}`,
        accelerator: 'Command+H',
        selector: 'hide:',
      },
      {
        label: 'Hide Others',
        accelerator: 'Command+Shift+H',
        selector: 'hideOtherApplications:',
      },
      { label: 'Show All', selector: 'unhideAllApplications:' },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'Command+Q',
        click: () => {
          options.actions.quit()
        },
      },
    ],
  }

  const editMenu: DesktopMenuItem = {
    label: 'Edit',
    submenu: [
      { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
      { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
      { type: 'separator' },
      { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
      { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
      { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
      {
        label: 'Select All',
        accelerator: 'Command+A',
        selector: 'selectAll:',
      },
    ],
  }

  let viewMenu: DesktopMenuItem = {
    label: 'View',
    submenu: [
      {
        label: 'Toggle Full Screen',
        accelerator: 'Ctrl+Command+F',
        click: () => {
          options.actions.toggleFullScreen()
        },
      },
    ],
  }
  if (options.isDevelopment) {
    viewMenu = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            options.actions.reload()
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            options.actions.toggleFullScreen()
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            options.actions.toggleDeveloperTools()
          },
        },
      ],
    }
  }

  const windowMenu: DesktopMenuItem = {
    label: 'Window',
    submenu: [
      {
        label: 'Minimize',
        accelerator: 'Command+M',
        selector: 'performMiniaturize:',
      },
      { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
      { type: 'separator' },
      { label: 'Bring All to Front', selector: 'arrangeInFront:' },
    ],
  }

  const helpMenu: DesktopMenuItem = {
    label: 'Help',
    submenu: [
      {
        label: 'Learn More',
        click: () => {
          options.actions.openExternal('https://electronjs.org')
        },
      },
      {
        label: 'Documentation',
        click: () => {
          options.actions.openExternal(
            'https://github.com/electron/electron/tree/main/docs#readme',
          )
        },
      },
      {
        label: 'Community Discussions',
        click: () => {
          options.actions.openExternal('https://www.electronjs.org/community')
        },
      },
      {
        label: 'Search Issues',
        click: () => {
          options.actions.openExternal('https://github.com/electron/electron/issues')
        },
      },
    ],
  }

  return [aboutMenu, editMenu, viewMenu, windowMenu, helpMenu]
}

function buildDefaultTemplate(
  options: BuildDesktopMenuTemplateOptions,
): DesktopMenuItem[] {
  return [
    {
      label: '&File',
      submenu: [
        {
          label: '&Open',
          accelerator: 'Ctrl+O',
        },
        {
          label: '&Close',
          accelerator: 'Ctrl+W',
          click: () => {
            options.actions.closeWindow()
          },
        },
      ],
    },
    {
      label: '&View',
      submenu: buildDefaultViewSubmenu(options),
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: () => {
            options.actions.openExternal('https://electronjs.org')
          },
        },
        {
          label: 'Documentation',
          click: () => {
            options.actions.openExternal(
              'https://github.com/electron/electron/tree/main/docs#readme',
            )
          },
        },
        {
          label: 'Community Discussions',
          click: () => {
            options.actions.openExternal('https://www.electronjs.org/community')
          },
        },
        {
          label: 'Search Issues',
          click: () => {
            options.actions.openExternal('https://github.com/electron/electron/issues')
          },
        },
      ],
    },
  ]
}

function buildDefaultViewSubmenu(
  options: BuildDesktopMenuTemplateOptions,
): DesktopMenuItem[] {
  const submenu: DesktopMenuItem[] = [
    {
      label: 'Toggle &Full Screen',
      accelerator: 'F11',
      click: () => {
        options.actions.toggleFullScreen()
      },
    },
  ]

  if (!options.isDevelopment) {
    return submenu
  }

  return [
    {
      label: '&Reload',
      accelerator: 'Ctrl+R',
      click: () => {
        options.actions.reload()
      },
    },
    ...submenu,
    {
      label: 'Toggle &Developer Tools',
      accelerator: 'Alt+Ctrl+I',
      click: () => {
        options.actions.toggleDeveloperTools()
      },
    },
  ]
}
