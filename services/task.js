const { taskApi } = require('./api');

class TaskService {
  static async submitTask(params) {
    const res = await taskApi.submitTask(params)
    if (!res.success) {
      throw new Error(res.message || '提交任务失败')
    }
    return res.data
  }

  static async createTask(params) {
    const res = await taskApi.createTask(params);
    if (!res.success) {
      throw new Error(res.message || '创建任务失败');
    }
    return res.data;
  }

  static async getTasks(params = {}) {
    const res = await taskApi.getTasks(params);
    if (!res.success) {
      throw new Error(res.message || '获取任务列表失败');
    }
    return res.data;
  }

  static async getTaskDetail(taskId) {
    const res = await taskApi.getTaskDetail(taskId);
    if (!res.success) {
      throw new Error(res.message || '获取任务详情失败');
    }
    return res.data;
  }

  static async getSubmissions(params = {}) {
    const res = await taskApi.getSubmissions(params)
    if (!res.success) {
      throw new Error(res.message || '获取提交记录失败')
    }
    return res.data
  }

  static async updateTask(params) {
    const res = await taskApi.updateTask(params);
    if (!res.success) {
      throw new Error(res.message || '更新任务失败');
    }
    return res.data;
  }

  static async deleteTask(taskId) {
    const res = await taskApi.deleteTask(taskId);
    if (!res.success) {
      throw new Error(res.message || '删除任务失败');
    }
    return res.data;
  }
}

module.exports = TaskService;
