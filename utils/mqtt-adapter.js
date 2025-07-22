// utils/mqtt-adapter.js
import mqtt from './mqtt.min.js';

class MQTTConsole {
  constructor() {
    this.client = null;
    this.messageQueue = [];
    this.subscriptions = new Map(); // 订阅主题管理
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * 连接MQTT服务器
   * @param {Object} options 连接配置
   * @returns {Promise} 返回连接Promise
   */
  connect(options) {
    return new Promise((resolve, reject) => {
      // 合并默认参数
      const config = {
        protocol: 'wxs',
        host: '',
        port: 443,
        path: '/mqtt',
        clientId: `wx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        username: '',
        password: '',
        keepalive: 30,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        will: null,
        ...options
      };

      // 验证必要参数
      if (!config.host) {
        return reject(new Error('MQTT服务器地址不能为空'));
      }

      const url = this._buildUrl(config);
      
      this.client = mqtt.connect(url, {
        clientId: config.clientId,
        username: config.username,
        password: config.password,
        keepalive: config.keepalive,
        clean: config.clean,
        reconnectPeriod: config.reconnectPeriod,
        connectTimeout: config.connectTimeout,
        will: config.will,
        resubscribe: true // 自动重新订阅
      });

      this._setupEventHandlers(resolve, reject);
    });
  }

  /**
   * 订阅主题
   * @param {String|Array} topic 主题或主题数组
   * @param {Object} [options] 订阅选项
   * @returns {Promise} 返回订阅Promise
   */
  subscribe(topic, options = { qos: 1 }) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        return reject(new Error('MQTT连接未建立'));
      }

      const topics = Array.isArray(topic) ? topic : [topic];
      
      this.client.subscribe(topics, options, (err, granted) => {
        if (err) {
          this._log(`[错误] 订阅失败: ${err.message}`, 'error');
          return reject(err);
        }

        granted.forEach(item => {
          this.subscriptions.set(item.topic, item.qos);
          this._log(`[系统] 已订阅: ${item.topic} (QoS ${item.qos})`);
        });
        
        resolve(granted);
      });
    });
  }

  /**
   * 发布消息
   * @param {String} topic 主题
   * @param {String|Buffer} payload 消息内容
   * @param {Object} [options] 发布选项
   * @returns {Promise} 返回发布Promise
   */
  publish(topic, payload, options = { qos: 1, retain: false }) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        return reject(new Error('MQTT连接未建立'));
      }

      this.client.publish(topic, payload, options, err => {
        if (err) {
          this._log(`[错误] 发布失败: ${err.message}`, 'error');
          return reject(err);
        }
        this._log(`[发送] ${topic}: ${payload}`);
        resolve();
      });
    });
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.client) {
      this.client.end();
      this._log('[系统] 连接已主动断开');
    }
  }

  /**
   * 获取当前连接状态
   * @returns {Boolean} 连接状态
   */
  isConnected() {
    return this.client ? this.client.connected : false;
  }

  /**
   * 获取订阅列表
   * @returns {Array} 订阅主题数组
   */
  getSubscriptions() {
    return Array.from(this.subscriptions.entries());
  }

  /**
   * 清除日志
   */
  clearLogs() {
    this.messageQueue = [];
    wx.removeStorageSync('mqtt_logs');
  }

  // ========== 私有方法 ==========
  _setupEventHandlers(resolve, reject) {
    this.client
      .on('connect', () => {
        this.reconnectAttempts = 0;
        this._log('[系统] MQTT连接成功');
        resolve(this.client);
      })
      .on('reconnect', () => {
        this.reconnectAttempts++;
        if (this.reconnectAttempts <= this.maxReconnectAttempts) {
          this._log(`[系统] 正在重新连接(${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        } else {
          this.client.end();
          const err = new Error('超过最大重连次数');
          this._log(`[错误] ${err.message}`, 'error');
          reject(err);
        }
      })
      .on('error', (err) => {
        this._log(`[错误] ${err.message}`, 'error');
        reject(err);
      })
      .on('message', (topic, payload) => {
        this._log(`[接收] ${topic}: ${payload.toString()}`);
      })
      .on('close', () => {
        this._log('[系统] 连接已关闭');
      })
      .on('offline', () => {
        this._log('[警告] 网络连接断开');
      });
  }

  _buildUrl(config) {
    return `${config.protocol}://${config.host}:${config.port}${config.path}`;
  }

  _log(message, type = 'info') {
    const logEntry = {
      timestamp: Date.now(),
      content: message,
      type
    };
    
    this.messageQueue.push(logEntry);
    if (this.messageQueue.length > 1000) {
      this.messageQueue.shift(); // 限制日志数量
    }
    
    wx.setStorageSync('mqtt_logs', this.messageQueue);
    
    // 触发日志更新事件
    if (this.onLogUpdate) {
      this.onLogUpdate(logEntry);
    }
  }
}

export default new MQTTConsole();