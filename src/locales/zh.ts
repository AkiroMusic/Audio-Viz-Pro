const zh = {
  // App
  app: {
    title: 'AudioViz Pro',
    subtitle: 'by AkiroMusic',
  },

  // Visualizer names and descriptions
  visualizers: {
    frequencyBars: { name: '频率条形', description: '经典频率条形图，支持发光效果' },
    radialSpectrum: { name: '辐射光谱', description: '圆形放射状频率图' },
    oscilloscope: { name: '波形示波器', description: '实时波形显示，复古风格' },
    aurora: { name: '极光', description: '流动的极光带，随音频起伏' },
    waterfall: { name: '频谱瀑布', description: '滚动频谱图，时间维度展示' },
    lissajous: { name: '李萨如', description: '左右声道 XY 波形图' },
    particleStorm: { name: '粒子风暴', description: '音频驱动的 3D 粒子系统' },
    frequencyTerrain: { name: '3D 地形', description: '频率数据生成的 3D 地形网格' },
    dnaHelix: { name: 'DNA 螺旋', description: '双螺旋结构随节拍旋转扭曲' },
    galaxySpiral: { name: '星系螺旋', description: '螺旋星系粒子系统' },
  },

  // Color themes
  themes: {
    neon: '霓虹',
    fire: '火焰',
    ocean: '海洋',
    aurora: '极光',
    mono: '单色',
    plasma: '等离子',
    custom: '自定义',
  },

  // Presets
  presets: {
    neonBars: '霓虹条形',
    fireSpectrum: '火焰光谱',
    galaxyCruise: '星系漫游',
    dnaPlasma: 'DNA 等离子',
    retroScope: '复古示波器',
  },

  // Keyboard shortcuts
  shortcuts: {
    playPause: '播放/暂停',
    seek: '快退/快进 5 秒',
    volume: '增大/减小音量',
    prevNext: '上一个 / 下一个可视化',
    cycleColor: '切换颜色主题',
    randomColor: '随机颜色',
    mirror: '开关镜像模式',
    fullscreen: '全屏切换',
    screenshot: '截图',
    closePanel: '关闭面板',
    help: '快捷键',
  },

  // Left Panel
  leftPanel: {
    visualizers: '可视化效果',
    globalParams: '全局参数',
    fftSize: 'FFT 大小',
    sensitivity: '灵敏度',
    smoothing: '平滑度',
    particleCount: '粒子数量',
    noiseIntensity: '噪波强度',
    presetManage: '预设管理',
    shortcuts: '快捷键',
    resetParams: '重置参数',
  },

  // Right Panel
  rightPanel: {
    colorThemes: '颜色主题',
    customColors: '自定义颜色',
    randomColor: '随机颜色',
    trail: '拖尾效果',
    glow: '发光强度',
    lineWidth: '线宽',
    barSpacing: '条形间距',
    freqDistribution: '频率分布',
    mirror: '镜像模式',
    rotation: '旋转速度',
    radialThickness: '辐射厚度',
    auroraLayers: '极光层数',
    terrainRes: '地形精度',
    helixSegments: '螺旋段数',
    galaxyArms: '星系臂数',
    bgColor: '背景颜色',
    export: '导出',
  },

  // Audio Player
  player: {
    uploadFile: '上传音频文件',
    enableMic: '开启麦克风',
    disableMic: '关闭麦克风',
    selectDevice: '选择输入设备',
    defaultDevice: '默认设备',
    play: '播放',
    pause: '暂停',
    volume: '音量',
    noAudio: '未加载音频',
    fullscreen: '全屏',
  },

  // Drop Zone
  dropZone: {
    dropToLoad: '释放以加载音频',
    supportedFormats: '支持 MP3, WAV, OGG, FLAC 格式',
  },

  // Export Panel
  export: {
    title: '导出',
    close: '关闭',
    screenshot: '截图导出',
    screenshotPng: '截图 (PNG)',
    video: '视频录制',
    startRecording: '开始录制',
    stopRecording: '停止录制',
    processing: '处理中...',
    recordingDone: '录制完成！文件已下载',
    videoFormat: '视频为 WebM 格式，含音频轨道',
    resolution: '分辨率',
    resOriginal: '原始分辨率',
    gif: 'GIF 导出',
    duration: '时长',
    frameRate: '帧率',
    startGif: '开始录制 GIF',
    stopGif: '停止 GIF',
    recording: '录制中...',
    render: '离线渲染',
    renderDesc: '使用纯 JS FFT 预计算 + ffmpeg.wasm 编码，比实时录制更快',
    renderVideo: '开始渲染',
    codec: '编码器',
    rendering: '渲染中...',
    renderComplete: '渲染完成！',
    downloadVideo: '保存视频',
  },

  // Render Dialog（离线渲染向导）
  render: {
    title: '离线渲染',
    close: '关闭',
    step1Title: '输出设置',
    step2Title: '分辨率',
    step3Title: '帧率',
    step4Title: '码率',
    step5Title: '渲染',
    outputDir: '输出目录',
    outputDirNotSet: '未选择目录（将保存到下载文件夹）',
    selectDir: '选择目录',
    resolution: '分辨率',
    fps: '帧率',
    bitrate: '码率',
    bitrateLow: '低（2 Mbps）',
    bitrateMedium: '中（4 Mbps）',
    bitrateHigh: '高（8 Mbps）',
    bitrateCustom: '自定义',
    bitrateCustomPlaceholder: '如 8M、12M',
    codec: '编码器',
    startRender: '开始渲染',
    cancelRender: '取消渲染',
    back: '上一步',
    next: '下一步',
    rendering: '渲染中...',
    encoding: '编码中...',
    decoding: '解码中...',
    done: '渲染完成！',
    saveVideo: '保存视频',
    renderFailed: '渲染失败',
    confirm: '确认',
  },

  // Preset Panel
  presetManage: {
    title: '预设管理',
    saveCurrent: '保存当前配置',
    presetNamePlaceholder: '输入预设名称...',
    save: '保存',
    builtin: '内置预设',
    myPresets: '我的预设',
    load: '加载',
    delete: '删除',
  },
}

export type Translations = typeof zh
export default zh
