import { GRADE_OPTIONS } from '../../utils/constant'

Component({
  properties: {
    // 表单数据
    userInfo: {
      type: Object,
      value: {}
    },
    // 表单验证规则
    rules: {
      type: Object,
      value: {}
    },
    // 是否显示错误
    showErrors: {
      type: Boolean,
      value: true
    }
  },

  data: {
    grades: GRADE_OPTIONS,
    defaultAvatarUrl: '/assets/default-avatar.png',
    birthdayPickerVisible: false,
    gradePickerVisible: false,
    phoneError: false,
    date: '',
    avatarChanged: false,
  },

  methods: {

    onChooseAvatar(e) {
      const { field } = e.currentTarget.dataset
      const { avatarUrl } = e.detail 
      this.setData({
        [`${field}`]: avatarUrl,
        avatarChanged: true
      })
    },
  
    onGradePicker() {
      this.setData({
        gradePickerVisible: true
      })
    },
  
    onBirthdayPicker() {
      this.setData({
        birthdayPickerVisible: true
      })
      this.setData({
        date: new Date().toLocaleDateString()
      })
    },
  
    onPickerChange(e) {
      const { key } = e.currentTarget.dataset;
      let { value } = e.detail;
      if (key === 'userInfo.grade') {
        value = value[0]
      }
      this.setData({
        [`${key}`]: value
      });
      this.onPickerCancel(e)
    },
  
    onPickerCancel(e) {
      this.setData({
        gradePickerVisible : false
      })
    },
  
    onBirthdayCancel(e) {
      this.setData({
        birthdayPickerVisible: false
      })
    },
  
    onPhoneInput(e) {
      const { field } = e.currentTarget.dataset
      const { phoneError } = this.data;
      const value = e.detail.value;
      const isPhoneNumber = /^[1][3,4,5,7,8,9][0-9]{9}$/.test(value);
  
      this.setData({
        [`${field}`]: value,
        phoneError: !isPhoneNumber
      });
    },
  
    onInputChange(e) {
      const { field } = e.currentTarget.dataset;
      const { value } = e.detail;
      this.setData({
        [`${field}`]: value
      });
    },

    // 获取表单数据
    getFormData() {
      return this.data
    },

    isAvatarChanged() {
      return this.data.avatarChanged;
    },

    // 设置表单数据
    setFormData(data) {
      this.setData({
        formData: { ...this.data.formData, ...data }
      });
    },

    // 重置表单
    resetForm() {
      this.setData({
        formData: {},
        errors: {},
        fieldErrors: {}
      });
      this.triggerEvent('reset');
    },

    // 获取错误信息
    getErrors() {
      return this.data.fieldErrors;
    }
  }
});
