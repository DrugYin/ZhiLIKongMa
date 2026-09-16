<template>
  <section>
    <PageHeader eyebrow="Subscribe Messages" title="消息统计" description="查看微信订阅消息接口的发送结果；成功表示接口已受理，不代表用户已阅读。">
      <template #actions><t-button variant="outline" :loading="loading" @click="loadAll">刷新</t-button></template>
    </PageHeader>

    <div class="message-stat-grid">
      <t-card v-for="item in statCards" :key="item.label" :bordered="false" class="message-stat-card">
        <span>{{ item.label }}</span><strong>{{ item.value }}</strong><em>{{ item.description }}</em>
      </t-card>
    </div>

    <t-row :gutter="[16, 16]" class="message-chart-row">
      <t-col :span="8"><t-card title="每日发送趋势"><div ref="trendChartRef" class="message-chart"></div></t-card></t-col>
      <t-col :span="4">
        <t-card title="失败原因">
          <div v-if="errors.length" class="message-error-list">
            <div v-for="item in errors" :key="item.error_code"><span>{{ getErrorCodeLabel(item.error_code) }}</span><strong>{{ item.count }}</strong></div>
          </div>
          <t-empty v-else title="暂无失败记录" />
        </t-card>
      </t-col>
    </t-row>

    <t-card :bordered="false" class="config-card message-log-card">
      <div class="config-toolbar message-toolbar">
        <t-select v-model="filters.range_type" class="message-filter" @change="handleRangeChange">
          <t-option label="最近7天" value="7d"/><t-option label="最近30天" value="30d"/><t-option label="最近90天" value="90d"/><t-option label="最近365天" value="365d"/>
        </t-select>
        <t-select v-model="filters.message_type" clearable placeholder="全部消息" class="message-filter" @change="handleSearch" @clear="handleSearch">
          <t-option v-for="item in MESSAGE_TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value"/>
        </t-select>
        <t-select v-model="filters.status" clearable placeholder="全部状态" class="message-filter" @change="handleSearch" @clear="handleSearch">
          <t-option label="发送成功" value="success"/><t-option label="发送失败" value="failed"/>
        </t-select>
        <t-select v-model="filters.miniprogram_state" clearable placeholder="全部版本" class="message-filter" @change="handleSearch" @clear="handleSearch">
          <t-option label="开发版" value="developer"/><t-option label="体验版" value="trial"/><t-option label="正式版" value="formal"/>
        </t-select>
        <t-input v-model="filters.error_code" clearable placeholder="错误码" class="message-filter" @enter="handleSearch" @clear="handleSearch"/>
        <t-button :loading="loading" @click="handleSearch">查询</t-button>
      </div>

      <div class="message-template-strip">
        <t-tag v-for="item in templateStats" :key="item.type" theme="primary" variant="light">
          {{ getMessageTypeLabel(item.type) }} {{ item.total }} 次 / {{ item.success_rate.toFixed(1) }}%
        </t-tag>
      </div>

      <div class="message-table-shell">
        <t-table row-key="_id" class="message-table" :data="rows" :columns="columns" :loading="loading" :pagination="pagination" hover @page-change="handlePageChange">
          <template #message_type="{ row }">{{ getMessageTypeLabel(row.message_type) }}</template>
          <template #status="{ row }"><t-tag :theme="row.status === 'success' ? 'success' : 'danger'" variant="light">{{ getSendStatusLabel(row.status) }}</t-tag></template>
          <template #recipient="{ row }">{{ row.recipient_openid_masked || '****' }}</template>
          <template #error="{ row }">{{ row.status === 'failed' ? getErrorCodeLabel(row.error_code) : '--' }}</template>
          <template #create_time="{ row }">{{ formatDateTime(row.create_time) }}</template>
          <template #op="{ row }"><t-button size="small" variant="text" @click="openDetail(row)">详情</t-button></template>
        </t-table>
      </div>
    </t-card>

    <t-dialog v-model:visible="detailVisible" header="发送详情" width="760px" :footer="false">
      <div v-if="selected" class="message-detail">
        <div><span>消息类型</span><strong>{{ getMessageTypeLabel(selected.message_type) }}</strong></div>
        <div><span>发送状态</span><strong>{{ getSendStatusLabel(selected.status) }}</strong></div>
        <div><span>接收人</span><strong>{{ selected.recipient_openid_masked || '****' }}</strong></div>
        <div><span>运行版本</span><strong>{{ selected.miniprogram_state || '--' }}</strong></div>
        <div><span>来源云函数</span><strong>{{ selected.source_function || '--' }}</strong></div>
        <div><span>关联业务</span><strong>{{ selected.event_key || '--' }}</strong></div>
        <div class="message-detail-wide"><span>错误信息</span><strong>{{ selected.error_message || '--' }}</strong></div>
      </div>
    </t-dialog>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import { getSubscribeMessageLogDetail, getSubscribeMessageLogs, getSubscribeMessageStatistics } from '@/api/subscribe-messages';
import { MESSAGE_TYPE_OPTIONS, getErrorCodeLabel, getMessageTypeLabel, getSendStatusLabel } from '@/constants/subscribe-message';
import { formatDateTime, formatNumber, formatPercentValue } from '@/utils/format';

const loading = ref(false); const rows = ref([]); const total = ref(0); const errors = ref([]); const trend = ref([]);
const detailVisible = ref(false); const selected = ref(null); const trendChartRef = ref(null); let chart = null; let echartsCore = null;
const overview = reactive({ total: 0, success: 0, failed: 0, success_rate: 0 }); const templates = reactive({});
const filters = reactive({ range_type: '30d', message_type: '', status: '', miniprogram_state: '', error_code: '', page: 1, pageSize: 20 });
const columns = [{ colKey:'message_type',title:'消息类型',width:180 },{ colKey:'status',title:'状态',width:110 },{ colKey:'recipient',title:'接收人',width:150 },{ colKey:'miniprogram_state',title:'版本',width:90 },{ colKey:'source_function',title:'来源',width:150 },{ colKey:'error',title:'结果说明',width:220 },{ colKey:'create_time',title:'发送时间',width:180 },{ colKey:'op',title:'操作',width:80 }];
const pagination = computed(() => ({ current: filters.page, pageSize: filters.pageSize, total: total.value, showJumper:true, showPageSize:true }));
const statCards = computed(() => [{label:'发送总数',value:formatNumber(overview.total,'0'),description:'实际调用微信接口'},{label:'发送成功',value:formatNumber(overview.success,'0'),description:'接口受理成功'},{label:'发送失败',value:formatNumber(overview.failed,'0'),description:'可查看错误原因'},{label:'成功率',value:formatPercentValue(overview.success_rate),description:'成功数 / 发送总数'}]);
const templateStats = computed(() => MESSAGE_TYPE_OPTIONS.map((item) => ({ type:item.value, ...(templates[item.value] || {total:0,success_rate:0}) })));

async function loadStatistics(){ const data=await getSubscribeMessageStatistics(filters.range_type); Object.assign(overview,data.overview||{}); Object.assign(templates,data.templates||{}); trend.value=data.trend||[]; errors.value=data.errors||[]; await renderChart(); }
async function loadLogs(){ const data=await getSubscribeMessageLogs({ ...filters, page_size:filters.pageSize }); rows.value=data.list||[]; total.value=data.total||0; }
async function loadAll(){ loading.value=true; try{ await Promise.all([loadStatistics(),loadLogs()]); }catch(error){ MessagePlugin.error(error.message||'消息统计加载失败'); }finally{ loading.value=false; } }
function handleSearch(){ filters.page=1; loadLogs(); } function handleRangeChange(){ filters.page=1; loadAll(); }
function handlePageChange(info){ filters.page=info.current||1; filters.pageSize=info.pageSize||filters.pageSize; loadLogs(); }
async function openDetail(row){ detailVisible.value=true; selected.value=row; try{ const data=await getSubscribeMessageLogDetail(row._id); selected.value=data.log||row; }catch(error){ MessagePlugin.warning(error.message||'详情加载失败'); } }
async function renderChart(){ if(!echartsCore){ const [e,c,co,r]=await Promise.all([import('echarts/core'),import('echarts/charts'),import('echarts/components'),import('echarts/renderers')]); e.use([c.BarChart,c.LineChart,co.GridComponent,co.LegendComponent,co.TooltipComponent,r.CanvasRenderer]); echartsCore=e; } await nextTick(); if(!trendChartRef.value)return; if(!chart)chart=echartsCore.init(trendChartRef.value); chart.setOption({color:['#1d6f5f','#d95d39'],tooltip:{trigger:'axis'},legend:{top:0,right:0},grid:{left:42,right:20,top:46,bottom:28},xAxis:{type:'category',data:trend.value.map(i=>i.date.slice(5))},yAxis:{type:'value',minInterval:1},series:[{name:'成功',type:'bar',data:trend.value.map(i=>i.success)},{name:'失败',type:'line',smooth:true,data:trend.value.map(i=>i.failed)}]}); }
function resize(){ chart?.resize(); } onMounted(()=>{loadAll();window.addEventListener('resize',resize);}); onBeforeUnmount(()=>{window.removeEventListener('resize',resize);chart?.dispose();});
</script>
