<template>
  <div>
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- PROPS                                                              -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 1: Props (:count, label)</h2>
    <wcc-counter id="test1" :count="propCount" label="Static Label"></wcc-counter>
    <p>Vue propCount: {{ propCount }}</p>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- EVENTS                                                             -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 2: Events (@count-changed)</h2>
    <wcc-counter id="test2" :count="eventCount" @count-changed="eventCount = $event.detail"></wcc-counter>
    <p>Vue eventCount: {{ eventCount }}</p>
    <button @click="eventCount++">Vue increment (manual)</button>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- TWO-WAY BINDING (v-model)                                          -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 3: v-model:count (plugin)</h2>
    <wcc-counter id="test3" v-model:count="modelCount"></wcc-counter>
    <p>Vue modelCount: {{ modelCount }}</p>
    <button @click="modelCount++">Vue increment (v-model)</button>

    <h2>Test 4: v-model.trim (modifier)</h2>
    <wcc-counter id="test4" v-model:count.number="trimCount"></wcc-counter>
    <p>Vue trimCount: {{ trimCount }} (type: {{ typeof trimCount }})</p>

    <h2>Test 4b: Multiple v-model on same element</h2>
    <wcc-counter id="test4b" v-model:count="multiCount" v-model:label="multiLabel"></wcc-counter>
    <p>Vue multiCount: {{ multiCount }}, multiLabel: {{ multiLabel }}</p>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- DEFAULT SLOT                                                       -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 5: Default slot (children)</h2>
    <wcc-card id="test5">
      <p>Body content via default slot</p>
    </wcc-card>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- NAMED SLOTS                                                        -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 6: Named slots (template #name)</h2>
    <wcc-card id="test6">
      <template #header><strong>Header via #</strong></template>
      <p>Body content</p>
      <template #footer>Footer via #</template>
    </wcc-card>

    <h2>Test 7: Named slots (template #name — nested)</h2>
    <wcc-card id="test7">
      <template #header><strong>Bold</strong> header with <em>emphasis</em></template>
      <p>Body content</p>
      <template #footer>Footer with <a href="#">link</a></template>
    </wcc-card>

    <h2>Test 8: Named slots (template v-slot:name)</h2>
    <wcc-card id="test8">
      <template v-slot:header><strong>Header v-slot</strong></template>
      <p>Body content</p>
      <template v-slot:footer>Footer v-slot</template>
    </wcc-card>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- SCOPED SLOTS                                                       -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 9: Scoped slot (template #item="{ item, index }")</h2>
    <wcc-list id="test9">
      <template #item="{ item, index }">
        <li><strong>{{ index }}</strong>: {{ item }}</li>
      </template>
    </wcc-list>

    <h2>Test 10: Scoped slot (v-slot:item)</h2>
    <wcc-list id="test10">
      <template v-slot:item="{ item }">
        <li class="custom">★ {{ item }}</li>
      </template>
    </wcc-list>

    <h2>Test 11: Scoped slot + Vue interpolation coexistence</h2>
    <wcc-list id="test11">
      <template #item="{ item }">
        <li>{{ item }} (Vue says: {{ vueMessage }})</li>
      </template>
    </wcc-list>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const propCount = ref(10)
const eventCount = ref(0)
const modelCount = ref(0)
const trimCount = ref(0)
const multiCount = ref(0)
const multiLabel = ref('hello')
const vueMessage = ref('hello from Vue!')
</script>
