const AuthService = require('../../../services/auth');
const ClassService = require('../../../services/class');
const Toast = require('../../../utils/toast');
const formatUtils = require('../../../utils/format');

Page({
  data: {
    loading: true,
    isLoggedIn: false,
    isRegistered: false,
    inviteCode: '',
    joinedClasses: [],
    pendingApplications: [],
    stats: {
      joinedCount: 0,
      pendingCount: 0
    }
  },

  onLoad() {
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
      isRegistered: isLoggedIn
    });

    if (!isLoggedIn) {
      this.setData({
        loading: false,
        joinedClasses: [],
        pendingApplications: [],
        stats: {
          joinedCount: 0,
          pendingCount: 0
        }
      });
      wx.stopPullDownRefresh();
      return;
    }

    if (!silent && !refreshing) {
      Toast.showLoading('班级状态加载中...');
    }

    try {
      const statusInfo = await ClassService.getMyClassStatus();
      const isRegistered = statusInfo.is_registered !== false;
      const joinedClasses = isRegistered
        ? (statusInfo.joined_classes || []).map((item) => this.formatJoinedClass(item))
        : [];
      const pendingApplications = isRegistered
        ? (statusInfo.pending_applications || []).map((item) => this.formatPendingApplication(item))
        : [];

      this.setData({
        isRegistered,
        joinedClasses,
        pendingApplications,
        stats: {
          joinedCount: joinedClasses.length,
          pendingCount: pendingApplications.length
        }
      });

      this._pageReady = true;
    } catch (error) {
      console.error('[student-class-manage] initPage error:', error);
      Toast.showToast(error.message || '班级状态获取失败');
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

  formatJoinedClass(item) {
    if (!item) {
      return null;
    }

    const memberCount = Number(item.member_count || 0);
    const maxMembers = Number(item.max_members || 0);

    return {
      ...item,
      memberText: maxMembers > 0 ? `${memberCount}/${maxMembers} 人` : `${memberCount} 人`,
      classTimeText: item.class_time || '待老师补充',
      locationText: item.location || '待老师补充',
      descriptionText: item.description || '暂无班级说明',
      teacherText: item.teacher_name || '待老师补充',
      joinTimeText: item.join_class_time
        ? formatUtils.formatDate(item.join_class_time, 'YYYY-MM-DD HH:mm')
        : '待记录'
    };
  },

  formatPendingApplication(item) {
    if (!item) {
      return null;
    }

    const memberCount = Number(item.member_count || 0);
    const maxMembers = Number(item.max_members || 0);

    return {
      ...item,
      memberText: maxMembers > 0 ? `${memberCount}/${maxMembers} 人` : `${memberCount} 人`,
      classTimeText: item.class_time || '待老师补充',
      locationText: item.location || '待老师补充',
      descriptionText: item.description || '暂无班级说明',
      teacherText: item.teacher_name || '待老师补充',
      applyReasonText: item.apply_reason || '未填写申请理由',
      createTimeText: item.create_time
        ? formatUtils.formatDate(item.create_time, 'YYYY-MM-DD HH:mm')
        : '刚刚'
    };
  },

  onInviteCodeChange(e) {
    const value = String(e.detail.value || '').replace(/\s+/g, '').toUpperCase();

    this.setData({
      inviteCode: value
    });
  },

  goLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  goToJoinConfirm() {
    if (!this.data.isLoggedIn || !this.data.isRegistered) {
      this.goLogin();
      return;
    }

    if (!this.data.inviteCode) {
      Toast.showToast('请输入老师提供的邀请码');
      return;
    }

    wx.navigateTo({
      url: `/pages/student/class-manage/join-confirm/join-confirm?class_code=${encodeURIComponent(this.data.inviteCode)}&from=manual_input`
    });
  },

  goToClassDetail(e) {
    const classId = String(e.currentTarget.dataset.classId || '').trim();

    if (!classId) {
      Toast.showToast('缺少班级ID');
      return;
    }

    wx.navigateTo({
      url: `/pages/student/class-manage/class-detail/class-detail?class_id=${classId}`
    });
  },

  onCopyClassCode(e) {
    const classCode = String(e.currentTarget.dataset.classCode || '');

    if (!classCode) {
      Toast.showToast('暂无邀请码');
      return;
    }

    wx.setClipboardData({
      data: classCode,
      success: () => {
        Toast.showSuccess('邀请码已复制');
      }
    });
  }
});
