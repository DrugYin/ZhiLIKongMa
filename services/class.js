const { classApi } = require('./api');

class ClassService {
  /**
   * 创建班级
   */
  static async createClass(params) {
    const res = await classApi.createClass(params);
    if (!res.success) {
      throw new Error(res.message || '创建班级失败');
    }
    return res.data;
  }

  /**
   * 更新班级
   */
  static async updateClass(params) {
    const res = await classApi.updateClass(params);
    if (!res.success) {
      throw new Error(res.message || '更新班级失败');
    }
    return res.data;
  }

  /**
   * 删除班级
   */
  static async deleteClass(classId) {
    const res = await classApi.deleteClass(classId);
    if (!res.success) {
      throw new Error(res.message || '删除班级失败');
    }
    return res.data;
  }

  /**
   * 获取班级列表
   */
  static async getClasses(params = {}) {
    const res = await classApi.getClasses(params);
    if (!res.success) {
      throw new Error(res.message || '获取班级列表失败');
    }
    return res.data;
  }

  /**
   * 获取班级详情
   */
  static async getClassDetail(classId) {
    const res = await classApi.getClassDetail(classId);
    if (!res.success) {
      throw new Error(res.message || '获取班级详情失败');
    }
    return res.data;
  }

  /**
   * 申请加入班级
   */
  static async joinClass(classCode, applyReason = '') {
    const res = await classApi.joinClass(classCode, applyReason);
    if (!res.success) {
      throw new Error(res.message || '申请加入班级失败');
    }
    return res.data;
  }

  /**
   * 处理入班申请
   */
  static async handleApplication(params) {
    const res = await classApi.handleApplication(params);
    if (!res.success) {
      throw new Error(res.message || '处理入班申请失败');
    }
    return res.data;
  }

  /**
   * 获取班级成员
   */
  static async getClassMembers(params) {
    const res = await classApi.getClassMembers(params);
    if (!res.success) {
      throw new Error(res.message || '获取班级成员失败');
    }
    return res.data;
  }

  /**
   * 移除班级成员
   */
  static async removeMember(classId, memberOpenid) {
    const res = await classApi.removeMember(classId, memberOpenid);
    if (!res.success) {
      throw new Error(res.message || '移除成员失败');
    }
    return res.data;
  }
}

module.exports = ClassService;
