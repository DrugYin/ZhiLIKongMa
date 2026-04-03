/**
 * API 调用封装
 */

/**
 * 调用云函数
 */
async function callFunction(config) {
  try {
    const res = await wx.cloud.callFunction({
      name: config.name,
      data: config.data || {}
    });

    const result = res.result;
    
    if (!result.success) {
      console.error(`[API Error] ${config.name}:`, result.message);
    }

    return result;
  } catch (error) {
    console.error(`[API Exception] ${config.name}:`, error);
    return {
      success: false,
      message: error.message || '网络请求失败',
      error_code: -1
    };
  }
}

/**
 * 云存储
 */
function uploadFile(filePath, cloudPath) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: res => resolve(res),
      fail: err => reject(err)
    });
  });
}

/**
 * 用户相关 API
 */
const userApi = {
  login() {
    return callFunction({ name: 'login' });
  },

  register(data) {
    return callFunction({ name: 'register', data });
  },

  getUserInfo() {
    return callFunction({ name: 'get-user-info' });
  },

  updateUser(data) {
    return callFunction({ name: 'update-user', data });
  },

  switchRole(role) {
    return callFunction({ name: 'switch-role', data: { role } });
  },

};

/**
 * 班级相关 API
 */
const classApi = {
  createClass(data) {
    return callFunction({ name: 'create-class', data });
  },

  updateClass(data) {
    return callFunction({ name: 'update-class', data });
  },

  deleteClass(class_id) {
    return callFunction({ name: 'delete-class', data: { class_id } });
  },

  getClasses(data) {
    return callFunction({ name: 'get-classes', data });
  },

  getClassDetail(class_id) {
    return callFunction({ name: 'get-class-detail', data: { class_id } });
  },

  getClassInviteInfo(class_code) {
    return callFunction({ name: 'get-class-invite-info', data: { class_code } });
  },

  getMyClassStatus() {
    return callFunction({ name: 'get-my-class-status' });
  },

  joinClass(class_code, apply_reason) {
    return callFunction({ name: 'join-class', data: { class_code, apply_reason } });
  },

  handleApplication(data) {
    return callFunction({ name: 'handle-join-application', data });
  },

  getClassMembers(data) {
    return callFunction({ name: 'get-class-members', data });
  },

  removeMember(class_id, member_openid) {
    return callFunction({ name: 'remove-member', data: { class_id, member_openid } });
  }
};

/**
 * 任务相关 API
 */
const taskApi = {
  createTask(data) {
    return callFunction({ name: 'create-task', data });
  },

  getTasks(data) {
    return callFunction({ name: 'get-tasks', data });
  },

  getTaskDetail(task_id) {
    return callFunction({ name: 'get-task-detail', data: { task_id } });
  },

  submitTask(data) {
    return callFunction({ name: 'submit-task', data });
  },

  reviewSubmission(data) {
    return callFunction({ name: 'review-submission', data });
  },

  getSubmissions(data) {
    return callFunction({ name: 'get-submissions', data });
  }
};

/**
 * 抽奖相关 API
 */
const lotteryApi = {
  getPrizes() {
    return callFunction({ name: 'get-prizes' });
  },

  startDraw() {
    return callFunction({ name: 'start-draw' });
  },

  getDrawRecords(data) {
    return callFunction({ name: 'get-draw-records', data });
  }
};

/**
 * 排行榜相关 API
 */
const rankingApi = {
  getRanking(data) {
    return callFunction({ name: 'get-ranking', data });
  }
};

/**
 * 配置相关 API
 */
const configApi = {
  getConfig(data) {
    return callFunction({ name: 'get-config', data });
  },

  getProjects(data) {
    return callFunction({ name: 'get-projects', data });
  }
};

module.exports = {
  callFunction,
  uploadFile,
  userApi,
  classApi,
  taskApi,
  lotteryApi,
  rankingApi,
  configApi
};
