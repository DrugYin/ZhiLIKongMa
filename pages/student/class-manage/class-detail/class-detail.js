const AuthService = require('../../../../services/auth');
const ClassService = require('../../../../services/class');
const Toast = require('../../../../utils/toast');
const formatUtils = require('../../../../utils/format');

Page({
  data: {
    classId: '',
    loading: true,
    isLoggedIn: false,
    errorText: '',
    currentOpenid: '',
    classInfo: null,
    members: [],
    memberStats: {
      total: 0,
      totalPoints: 0,
      averagePoints: 0,
      latestJoinText: '暂无成员'
    },
    taskSummary: {
      total: 0,
      published: 0,
      pending: 0
    }
  },

  onLoad(options) {
    const classId = String(options.class_id || '').trim();

    if (!classId) {
      Toast.showToast('缺少班级ID');
      setTimeout(() => {
        wx.navigateBack();
      }, 1200);
      return;
    }

    this.setData({
      classId,
      currentOpenid: AuthService.getOpenid() || ''
    });

    this.initPage();
  },

  onShow() {
    if (this._pageReady) {
      this.initPage({ silent: true });
    }
  },

  onPullDownRefresh() {
    this.initPage({ refreshing: true });
  },

  async initPage({ refreshing = false, silent = false } = {}) {
    const isLoggedIn = AuthService.isLoggedIn();

    this.setData({
      loading: true,
      isLoggedIn,
      errorText: ''
    });

    if (!isLoggedIn) {
      this.setData({
        loading: false,
        classInfo: null,
        members: [],
        memberStats: {
          total: 0,
          totalPoints: 0,
          averagePoints: 0,
          latestJoinText: '暂无成员'
        },
        taskSummary: {
          total: 0,
          published: 0,
          pending: 0
        }
      });
      wx.stopPullDownRefresh();
      return;
    }

    if (!silent && !refreshing) {
      Toast.showLoading('班级详情加载中...');
    }

    try {
      const [classInfo, members] = await Promise.all([
        this.loadClassDetail(),
        this.loadMembers()
      ]);

      const formattedMembers = members.map((item, index) => this.formatMemberItem(item, index));

      this.setData({
        classInfo: this.formatClassInfo(classInfo, formattedMembers.length),
        members: formattedMembers,
        memberStats: this.buildMemberStats(formattedMembers),
        taskSummary: this.buildTaskSummary(classInfo)
      });

      this._pageReady = true;
    } catch (error) {
      console.error('[student-class-detail] initPage error:', error);
      this.setData({
        classInfo: null,
        members: [],
        errorText: error.message || '班级详情加载失败'
      });
      Toast.showToast(error.message || '班级详情加载失败');
    } finally {
      this.setData({
        loading: false
      });

      if (!silent && !refreshing) {
        Toast.hideLoading();
      }

      wx.stopPullDownRefresh();
    }
  },

  async loadClassDetail() {
    return ClassService.getClassDetail(this.data.classId);
  },

  async loadMembers() {
    let page = 1;
    let hasMore = true;
    const result = [];

    while (hasMore) {
      const response = await ClassService.getClassMembers({
        class_id: this.data.classId,
        page,
        page_size: 50
      });
      const list = Array.isArray(response.list) ? response.list : [];

      result.push(...list);
      hasMore = Boolean(response.has_more);
      page += 1;
    }

    return result;
  },

  formatClassInfo(item = {}, memberTotal = 0) {
    const memberCount = Number(item.member_count || memberTotal || 0);
    const maxMembers = Number(item.max_members || 0);
    const usageRate = maxMembers > 0
      ? Math.min(100, Math.round((memberCount / maxMembers) * 100))
      : 0;

    return {
      ...item,
      className: item.class_name || '未命名班级',
      projectText: item.project_name || item.project_code || '未设置项目',
      teacherName: item.teacher_name || '待补充',
      classCode: item.class_code || '--',
      memberText: maxMembers > 0 ? `${memberCount}/${maxMembers} 人` : `${memberCount} 人`,
      classTimeText: item.class_time || '未设置上课时间',
      locationText: item.location || '未设置上课地点',
      descriptionText: item.description || '暂无班级说明',
      createTimeText: this.formatDateTime(item.create_time),
      updateTimeText: this.formatDateTime(item.update_time),
      usageRateText: `${usageRate}%`,
      statusText: item.status === 'active' ? '进行中' : '已停用',
      statusClass: item.status === 'active' ? 'status-active' : 'status-inactive'
    };
  },

  formatMemberItem(item = {}, index = 0) {
    const pointsValue = Number(item.total_points || item.points || 0);
    const isCurrentUser = Boolean(item._openid && item._openid === this.data.currentOpenid);

    return {
      ...item,
      displayName: item.user_name || item.nick_name || `成员${index + 1}`,
      avatar: item.avatar_url || '/assets/default-avatar.png',
      gradeText: item.grade || '未填写年级',
      joinTimeText: this.formatDateTime(item.join_class_time),
      pointsValue,
      pointsText: `${pointsValue} 分`,
      identityText: isCurrentUser ? '我' : '成员',
      identityClass: isCurrentUser ? 'identity-self' : 'identity-normal'
    };
  },

  buildMemberStats(list = []) {
    if (!list.length) {
      return {
        total: 0,
        totalPoints: 0,
        averagePoints: 0,
        latestJoinText: '暂无成员'
      };
    }

    const totalPoints = list.reduce((sum, item) => sum + Number(item.pointsValue || 0), 0);
    const latestJoinTime = list.reduce((latest, item) => {
      const current = new Date(item.join_class_time || 0).getTime();
      return current > latest ? current : latest;
    }, 0);

    return {
      total: list.length,
      totalPoints,
      averagePoints: Math.round(totalPoints / list.length),
      latestJoinText: latestJoinTime ? this.formatDateTime(latestJoinTime) : '未记录'
    };
  },

  buildTaskSummary(classInfo = {}) {
    const total = Number(classInfo.task_count || classInfo.task_total || 0);
    const published = Number(classInfo.published_task_count || 0);

    return {
      total,
      published,
      pending: Math.max(total - published, 0)
    };
  },

  formatDateTime(value) {
    if (!value) {
      return '--';
    }

    return formatUtils.formatDate(value, 'YYYY-MM-DD HH:mm');
  },

  onCopyInviteCode() {
    const { classInfo } = this.data;

    if (!classInfo || !classInfo.classCode || classInfo.classCode === '--') {
      Toast.showToast('暂无可复制的邀请码');
      return;
    }

    wx.setClipboardData({
      data: classInfo.classCode,
      success: () => {
        Toast.showSuccess('邀请码已复制', 2000);
      }
    });
  },

  goLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  goToTaskList() {
    const query = [`class_id=${encodeURIComponent(this.data.classId)}`];
    const className = this.data.classInfo && this.data.classInfo.className;

    if (className) {
      query.push(`class_name=${encodeURIComponent(className)}`);
    }

    wx.navigateTo({
      url: `/pages/student/task-manage/task-manage?${query.join('&')}`
    });
  },

  goBackToClassManage() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }

    wx.redirectTo({
      url: '/pages/student/class-manage/class-manage'
    });
  }
});
