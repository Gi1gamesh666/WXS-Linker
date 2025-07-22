// pages/index/index.js
import mqttConsole from '../../utils/mqtt-adapter';

Page({
  data: {
    // 连接配置表单
    configForm: {
      protocol: 'wxs',
      host: 'xxxx',
      port: '443',
      path: '/mqtt',
      clientId: '',
      username: 'xxxx',
      password: 'xxxx',
      keepalive: '60',
      cleanSession: true,
      autoReconnect: true
    },
    
    // 订阅/发布表单
    topicForm: {
      subscribeTopic: '',
      publishTopic: '',
      publishMessage: '',
      qos: '1',
      retain: false
    },
    
    // 状态数据
    isConnected: false,
    logs: [],
    advancedVisible: false,
    subscriptions: []
  },

  onLoad() {
    this.loadHistoryConfig();
    this.setupLogListener();
  },

  onUnload() {
    this.disconnect();
  },

  // ========== 配置处理 ==========
  toggleAdvanced() {
    this.setData({ advancedVisible: !this.data.advancedVisible });
  },

  loadHistoryConfig() {
    const savedConfig = wx.getStorageSync('mqtt_config');
    if (savedConfig) {
      this.setData({ configForm: savedConfig });
    }
  },

  saveConfig() {
    wx.setStorageSync('mqtt_config', this.data.configForm);
    wx.showToast({ title: '配置已保存' });
  },

  // ========== 表单处理 ==========
  handleConfigInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`configForm.${field}`]: e.detail.value
    });
  },

  handleTopicInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`topicForm.${field}`]: e.detail.value
    });
  },

  handleQosChange(e) {
    this.setData({
      'topicForm.qos': e.detail.value
    });
  },

  // ========== 连接控制 ==========
  connect() {
    if (this.data.isConnected) return;

    const options = {
      ...this.data.configForm,
      port: parseInt(this.data.configForm.port),
      keepalive: parseInt(this.data.configForm.keepalive),
      clean: this.data.configForm.cleanSession,
      reconnectPeriod: this.data.configForm.autoReconnect ? 5000 : 0,
      clientId: this.data.configForm.clientId || undefined
    };

    mqttConsole.connect(options)
      .then(() => {
        this.setData({ isConnected: true });
        this.addSystemLog('连接成功');
      })
      .catch(err => {
        this.addSystemLog(`连接失败: ${err.message}`, 'error');
      });
  },

  disconnect() {
    if (mqttConsole.isConnected()) {
      mqttConsole.disconnect();
      this.setData({ 
        isConnected: false,
        subscriptions: []
      });
      this.addSystemLog('已主动断开连接');
    }
  },

  // ========== 订阅/发布 ==========
  subscribe() {
    const { subscribeTopic, qos } = this.data.topicForm;
    if (!subscribeTopic) return;

    mqttConsole.subscribe(subscribeTopic, { qos: parseInt(qos) })
      .then(() => {
        this.setData({
          subscriptions: mqttConsole.getSubscriptions()
        });
      })
      .catch(err => {
        this.addSystemLog(`订阅失败: ${err.message}`, 'error');
      });
  },

  unsubscribe(topic) {
    mqttConsole.unsubscribe(topic)
      .then(() => {
        this.setData({
          subscriptions: mqttConsole.getSubscriptions()
        });
        this.addSystemLog(`已取消订阅: ${topic}`);
      })
      .catch(err => {
        this.addSystemLog(`取消订阅失败: ${err.message}`, 'error');
      });
  },

  publish() {
    const { publishTopic, publishMessage, qos, retain } = this.data.topicForm;
    if (!publishTopic || !publishMessage) return;

    mqttConsole.publish(
      publishTopic, 
      publishMessage, 
      { 
        qos: parseInt(qos), 
        retain 
      }
    ).catch(err => {
      this.addSystemLog(`发布失败: ${err.message}`, 'error');
    });
  },

  // ========== 日志处理 ==========
  setupLogListener() {
    mqttConsole.onLogUpdate = (log) => {
      this.setData({
        logs: [...this.data.logs, {
          ...log,
          time: new Date(log.timestamp).toLocaleTimeString()
        }]
      });
    };
  },

  addSystemLog(message, type = 'info') {
    mqttConsole._log(message, type);
  },

  clearLogs() {
    mqttConsole.clearLogs();
    this.setData({ logs: [] });
  }
});