<template>
  <div>
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- CONDITIONAL                                                        -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 12: Conditional (if/else-if/else)</h2>
    <wcc-conditional id="test12" :visible="condVisible"></wcc-conditional>
    <p>Vue condVisible: {{ condVisible }}</p>
    <button @click="condVisible = !condVisible">Toggle conditional</button>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- SHOW                                                               -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 13: Show directive</h2>
    <wcc-toggle id="test13" :show="showVisible"></wcc-toggle>
    <p>Vue showVisible: {{ showVisible }}</p>
    <button @click="showVisible = !showVisible">Toggle show</button>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- INPUT V-MODEL                                                      -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 14: Input v-model</h2>
    <wcc-input id="test14" v-model:value="inputValue" placeholder="Type something..."></wcc-input>
    <p>Vue inputValue: {{ inputValue }}</p>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- STYLED                                                             -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->

    <h2>Test 15: Styled (:class / :style)</h2>
    <wcc-styled id="test15" :variant="styledVariant" :color="styledColor"></wcc-styled>
    <p>Vue variant: {{ styledVariant }}, color: {{ styledColor }}</p>
    <button @click="styledVariant = styledVariant === 'primary' ? 'secondary' : 'primary'">Toggle variant</button>
    <button @click="styledColor = styledColor === '#333' ? '#e63946' : '#333'">Toggle color</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const condVisible = ref(true)
const showVisible = ref(true)
const inputValue = ref('')
const styledVariant = ref('primary')
const styledColor = ref('#333')
</script>
