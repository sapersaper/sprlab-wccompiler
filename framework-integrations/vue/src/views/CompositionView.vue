<template>
  <div>
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- WCC→WCC simple: wrapper > counter                                  -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 16: WCC→WCC simple (wrapper > counter)</h2>
    <wcc-wrapper id="test16" title="Wrapper Title">
      <wcc-counter :count="wrapperCount" label="Inner"></wcc-counter>
    </wcc-wrapper>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- 2 niveles: wrapper > card                                          -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 17: 2 niveles (wrapper > card)</h2>
    <wcc-wrapper id="test17" title="Card Wrapper">
      <wcc-card>
        <template #header>Nested Card</template>
        <p>Body inside wrapper</p>
      </wcc-card>
    </wcc-wrapper>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- wcc-parent con wcc-counter interno                                 -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 18: wcc-parent with internal wcc-counter</h2>
    <wcc-parent id="test18" :initial-count="parentInit" label="Parent" @count-changed="parentChanged = $event.detail"></wcc-parent>
    <p>Vue parentChanged: {{ parentChanged }}</p>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- each con wcc-counter por item                                      -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 19: each con wcc-counter por item</h2>
    <div id="test19-area">
      <wcc-wrapper v-for="(item, i) in eachItems" :key="i" :title="'Item ' + item">
        <wcc-counter :count="item" :label="'#' + i"></wcc-counter>
      </wcc-wrapper>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const wrapperCount = ref(5)
const parentInit = ref(3)
const parentChanged = ref(null)
const eachItems = ref([1, 2, 3])
</script>
