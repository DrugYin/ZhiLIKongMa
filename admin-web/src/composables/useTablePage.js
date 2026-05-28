import { reactive, ref } from 'vue';

export function useTablePage({
  initialFilters = {},
  initialPageSize = 20,
  request,
  getList = (data) => data.list || [],
  getTotal = (data) => data.total || 0,
  onError
}) {
  const filters = reactive({ ...initialFilters });
  const list = ref([]);
  const loading = ref(false);
  const pagination = reactive({
    current: 1,
    pageSize: initialPageSize,
    total: 0,
    showJumper: true,
    pageSizeOptions: [10, 20, 50, 100]
  });

  async function loadData(extra = {}) {
    loading.value = true;
    try {
      const data = await request({
        filters,
        pagination: {
          page: pagination.current,
          page_size: pagination.pageSize
        },
        extra
      });
      list.value = getList(data);
      pagination.total = getTotal(data);
      return data;
    } catch (error) {
      if (onError) {
        onError(error);
      } else {
        throw error;
      }
      return null;
    } finally {
      loading.value = false;
    }
  }

  function handleSearch() {
    pagination.current = 1;
    return loadData();
  }

  function handlePageChange(pageInfo = {}) {
    pagination.current = pageInfo.current || 1;
    pagination.pageSize = pageInfo.pageSize || pagination.pageSize;
    return loadData();
  }

  return {
    filters,
    list,
    loading,
    pagination,
    loadData,
    handleSearch,
    handlePageChange
  };
}
