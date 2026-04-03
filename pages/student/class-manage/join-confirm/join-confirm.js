const AuthService = require('../../../../services/auth');
const ClassService = require('../../../../services/class');
const Toast = require('../../../../utils/toast');

Page({
  data: {
    classCode: '',
    source: 'manual_input',
    loading: true,
    submitting: false,
    isLoggedIn: false,
    isRegistered: false,
    userStatus: 'guest',
    inviteInfo: null,
    pendingApplication: null,
    joinedClass: null,
    applyReason: '',
    pageError: ''
  },

  onLoad(options) {
    const classCode = String(options.class_code || '').trim().toUpperCase();

    this.setData({
      classCode,
      source: String(options.from || 'manual_input')
    });

    this.initPage();
  },

  onShow() {
    if (this._pageReady) {
      this.syncUserStatus({ silent: true });
    }
  },

  onPullDownRefresh() {
    this.initPage({ refreshing: true });
  },

  async initPage({ refreshing = false, silent = false } = {}) {
    if (!this.data.classCode) {
      this.setData({
        loading: false,
        pageError: '缺少班级邀请码，无法确认加入班级。'
      });
      wx.stopPullDownRefresh();
      return;
    }

    if (!silent && !refreshing) {
      Toast.showLoading('班级信息加载中...');
    }

    this.setData({
      loading: true,
      pageError: ''
    });

    try {
      const inviteInfo = await ClassService.getClassInviteInfo(this.data.classCode);

      this.setData({
        inviteInfo: this.formatInviteInfo(inviteInfo)
      });

      await this.syncUserStatus();
      this._pageReady = true;
    } catch (error) {
      console.error('[join-confirm] initPage error:', error);
      this.setData({
        pageError: error.message || '班级信息获取失败',
        inviteInfo: null
      });
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

  async syncUserStatus() {
    const isLoggedIn = AuthService.isLoggedIn();

    if (!isLoggedIn) {
      this.setData({
        isLoggedIn: false,
        isRegistered: false,
        userStatus: 'guest',
        pendingApplication: null,
        joinedClass: null
      });
      return;
    }

    const statusInfo = await ClassService.getMyClassStatus();
    const isRegistered = statusInfo.is_registered !== false;

    this.setData({
      isLoggedIn: true,
      isRegistered,
      userStatus: isRegistered ? (statusInfo.status || 'none') : 'guest',
      pendingApplication: this.formatPendingApplication(statusInfo.pending_application),
      joinedClass: this.formatJoinedClass(statusInfo.joined_class)
    });
  },

  formatInviteInfo(item) {
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
      isFull: Boolean(item.is_full)
    };
  },

  formatPendingApplication(item) {
    if (!item) {
      return null;
    }

    return {
      ...item,
      className: item.class_name || '待审核班级'
    };
  },

  formatJoinedClass(item) {
    if (!item) {
      return null;
    }

    return {
      ...item,
      className: item.class_name || '当前班级'
    };
  },

  onReasonChange(e) {
    this.setData({
      applyReason: String(e.detail.value || '').trimStart()
    });
  },

  goLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  goToClassManage() {
    wx.redirectTo({
      url: '/pages/student/class-manage/class-manage'
    });
  },

  async onApplyJoin() {
    if (this.data.submitting || !this.data.inviteInfo) {
      return;
    }

    if (!this.data.isLoggedIn || !this.data.isRegistered) {
      this.goLogin();
      return;
    }

    if (this.data.userStatus === 'joined') {
      Toast.showToast('你已经加入班级');
      return;
    }

    if (this.data.userStatus === 'pending') {
      Toast.showToast('你已有待审核申请');
      return;
    }

    if (this.data.inviteInfo.isFull) {
      Toast.showToast('班级人数已满，暂时无法申请');
      return;
    }

    this.setData({
      submitting: true
    });

    Toast.showLoading('正在提交申请...');

    try {
      await ClassService.joinClass(this.data.classCode, this.data.applyReason.trim());
      Toast.hideLoading();
      await Toast.showSuccess('申请已提交');

      setTimeout(() => {
        this.goToClassManage();
      }, 1000);
    } catch (error) {
      console.error('[join-confirm] onApplyJoin error:', error);
      Toast.hideLoading();
      Toast.showToast(error.message || '提交申请失败');
    } finally {
      this.setData({
        submitting: false
      });
    }
  }
});
