<script>
  import { bitable,ViewType,FieldType,ToastType } from '@lark-base-open/js-sdk';
  import { Scheduler } from '@/utils/scheduler';
  import { ref, onMounted } from 'vue';
  import {
    ElButton,
    ElForm,
    ElFormItem,
    ElSelect,
    ElOption,
    ElSwitch,
    ElTabsPane,
  } from 'element-plus';

  export default {
    components: {
      ElButton,
      ElForm,
      ElFormItem,
      ElSelect,
      ElOption,
      ElSwitch,
      ElTabsPane,
    },
    setup() {
      const formData = ref({ 
        table: '',
        view:'',
        taskField:'',
        stageField:'',
        stageName:'系统开发',
        personField:'',
        manualField:'',
        startTimeField: '',
        endTimeField: '',
        workHoursField:'' 
      });
      const tableMetaList = ref([]);
      const viewMetaList = ref([]);
      const fieldMetaList = ref({all:[],dateTimeFields:[],numFields:[]});

      const stageNameList = ref([]);
      const showAdvancedOptions = ref(false)
      
      // 配置响应式对象
      const config = ref({
        workdayStartHour: 9,
        dailyWorkHours: 8,
        taskInterval: 1
      });
      
      const initFieldSettings = async () => {};
      const checkPlan = async () => {};
      const clearEmptyTask = async () => {
        const tableId = formData.value.table;
        const table = await bitable.base.getTableById(tableId);
        const result = await table.getRecords({pageSize:1500});

        //删除任务为空的记录
        var ids = [];
        for (const record of result.records) {
          const taskCell = record.fields[formData.value.taskField];
          if(taskCell==null) ids.push(record.recordId);
        }
        if(ids.length==0) return;
        await table.deleteRecords(ids);
        await bitable.ui.showToast({
          toastType: ToastType.info,
          message: '已删除['+ids.length+']个空白任务'
        })
      };
      
      const allAutoPlan = async () => {
        const tableId = formData.value.table;
        const table = await bitable.base.getTableById(tableId);

        //获取视图内容
        const view = await table.getViewById(formData.value.view);
        const records =  await view.getVisibleRecordIdList();
        var tasks = []
        var projectStartTime= new Date().setHours(0,0,0,0);
        for (const recordId of records) {
          var record = await table.getRecordById(recordId);

          const taskCell = record.fields[formData.value.taskField];
          if(taskCell==null) continue;

          const stageCell = record.fields[formData.value.stageField]
          if(stageCell.text!=formData.value.stageName) continue;

          const personCell = record.fields[formData.value.personField];
          const workHoursCell = record.fields[formData.value.workHoursField];
          const startTimeCell = record.fields[formData.value.startTimeField];
          const endTimeCell = record.fields[formData.value.startTimeField];
          const manualCell = record.fields[formData.value.manualField];
          
          if(personCell==null){
            await bitable.ui.showToast({
              toastType: ToastType.info,
              message: '['+taskCell[0]?.text+']未分配任务执行人'
            })
            return;
          }
          
          tasks.push({
            recordId: recordId,
            name: taskCell[0]?.text,
            person: personCell[0]?.name,
            hours: workHoursCell,
            manual: manualCell,
            startTime: startTimeCell,
            endTime: endTimeCell
          });
        }

        const scheduler = new Scheduler(config.value);

        var plannedTasks = await scheduler.scheduleTasks(tasks,projectStartTime);
        var newRecords = [];
        for (const task of plannedTasks) {
          newRecords.push({
           recordId: task.recordId,
           fields: {
             [formData.value.startTimeField]: task.startTime,
             [formData.value.endTimeField]: task.endTime
           }
          });
        }
        await table.setRecords(newRecords);
        
      };

      onMounted(async () => {
        const [tableList, selection] = await Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection()]);
        formData.value.table = selection.tableId;
        formData.value.view = selection.viewId;
        tableMetaList.value = tableList.filter(({name})=>name=="✅  任务计划")
        if(tableMetaList.value)
          formData.value.table = tableMetaList.value[0].id;

        //通过tableId获取table数据表。 Find current table by tableId
        const table = await bitable.base.getTableById(selection?.tableId);
        //获取tabs的元信息。 Get tabs meta list
        viewMetaList.value = (await table.getViewMetaList()).filter(({type}) => type === ViewType.Grid);
        //获取table数据表的字段列表元信息。Get table's field meta list
        fieldMetaList.value.all = await table.getFieldMetaList();

        fieldMetaList.value.dateTimeFields 
          = await table.getFieldMetaListByType(FieldType.DateTime);
        fieldMetaList.value.numFields
          = await table.getFieldMetaListByType(FieldType.Number);
        
        var taskField 
          = fieldMetaList.value.all.find(({isPrimary}) => isPrimary==true);
        var stageField 
          = fieldMetaList.value.all.find(({name}) => name==='阶段' || name==='Stage');
        var personField 
          = fieldMetaList.value.all.find(({name}) => name==='任务执行人' || name==='Person');
        var manualField
          = fieldMetaList.value.all.find(({ name }) => name === '手动排期' || name === 'Manual Plan');
        var startTimeField
          = fieldMetaList.value.all.find(({ name }) => name === '开始时间' || name === 'Start Time');
        var endTimeField 
          = fieldMetaList.value.all.find(({ name }) => name === '结束时间' || name === 'End Time');
        var workHoursField 
          = fieldMetaList.value.all.find(({ name }) => name === '工时' || name === 'Work Hours');
        
        stageNameList.value = stageField.property.options.map(c=> { return {name:c.name}});
        
        formData.value.taskField = taskField.id;
        formData.value.stageField = stageField.id;
        formData.value.personField = personField.id;
        formData.value.manualField = manualField.id;
        formData.value.startTimeField = startTimeField.id;
        formData.value.endTimeField = endTimeField.id;
        formData.value.workHoursField = workHoursField.id;
      });

      return {
        formData,
        config,
        showAdvancedOptions,
        tableMetaList,
        viewMetaList,
        fieldMetaList,
        stageNameList,
        checkPlan,
        allAutoPlan,
        clearEmptyTask,
        initFieldSettings
      };
    }
  };
</script>

<template>
  <el-form ref="form" class="form" :model="formData" label-position="top">
    <el-form-item label="选择数据表" size="large">
        <el-select v-model="formData.table" placeholder="请选择数据表" style="width: 80%">
          <el-option
            v-for="meta in tableMetaList"
            :key="meta.id"
            :label="meta.name"
            :value="meta.id"
          />
        </el-select>
    </el-form-item>
    <el-form-item label="选择视图" size="large">
        <el-select v-model="formData.view" placeholder="请选择视图" style="width: 80%">
          <el-option
            v-for="meta in viewMetaList"
            :key="meta.id"
            :label="meta.name"
            :value="meta.id"
          />
        </el-select>
    </el-form-item>

    <el-form-item label="选择阶段" size="large">
        <el-select v-model="formData.stageName" placeholder="请选择阶段" style="width: 80%">
          <el-option
            v-for="meta in stageNameList"
            :key="meta.name"
            :label="meta.name"
            :value="meta.name"
          />
        </el-select>
    </el-form-item>

    <el-tabs v-model="activeName" class="demo-tabs">
      <el-tab-pane label="Plan" name="first">User
        <el-form-item size="large">
          <el-switch v-model="showAdvancedOptions" active-text="更多设置"/>
        </el-form-item>

        <div v-show="showAdvancedOptions">
          <el-form-item label="开始时间" size="large">
              <el-select v-model="formData.startTimeField" placeholder="请选择" style="width: 80%">
                <el-option
                  v-for="meta in fieldMetaList.dateTimeFields"
                  :key="meta.id"
                  :label="meta.name"
                  :value="meta.id"
                />
              </el-select>
          </el-form-item>
          <el-form-item label="结束时间" size="large">
              <el-select v-model="formData.endTimeField" placeholder="请选择" style="width: 80%">
                <el-option
                  v-for="meta in fieldMetaList.dateTimeFields"
                  :key="meta.id"
                  :label="meta.name"
                  :value="meta.id"
                />
              </el-select>
          </el-form-item>
          <el-form-item label="工时" size="large">
              <el-select v-model="formData.workHoursField" placeholder="请选择" style="width: 80%">
                <el-option
                  v-for="meta in fieldMetaList.numFields"
                  :key="meta.id"
                  :label="meta.name"
                  :value="meta.id"
                />
              </el-select>
          </el-form-item>
          <el-form-item label="每日投入工时" size="large">
              <el-input-number v-model="config.dailyWorkHours" :step="1" />
          </el-form-item>
        </div>

        <el-form-item label="排期" size="large">
          <el-button type="primary" plain size="large" @click="allAutoPlan">自动排期</el-button>
          <el-button type="primary" plain size="large" @click="checkPlan">检查排期</el-button>

        </el-form-item>

        <el-form-item label="其他" size="large">
          <el-button type="primary" plain size="large" @click="clearEmptyTask">删除空行</el-button>
        </el-form-item>
      </el-tab-pane>
      <el-tab-pane label="Settings" name="second">

        <el-button type="primary" plain size="large" @click="initFieldSettings">初始化字段设置</el-button>
      </el-tab-pane>
    </el-tabs>
    
    
  </el-form>
</template>




<style scoped>
  .form :deep(.el-form-item__label) {
    font-size: 16px;
    color: var(--el-text-color-primary);
    margin-bottom: 0;
  }
  .form :deep(.el-form-item__content) {
    font-size: 16px;
  }
</style>
