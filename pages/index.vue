<template>
  <div class='sol'>
   <div class='sol__btns'>
     <button @click='connect'>
       Connect! {{'{'}}{{isConnected}}{{'}'}}
     </button>
     <button @click='fetchCounterInfo'>
       Fetch!
     </button>
     <button @click='executeMethod'>
       Execute!
     </button>
   </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { init, fetchCounterInfo, executeMethod, connect } from '~/utils'

export default Vue.extend({
  data: () => ({
    isConnected: false
  }),
  async mounted() {
    await init()
  },
  methods: {
    async connect() {
      this.isConnected = await connect()
    },
    async fetchCounterInfo() {
      const r = await fetchCounterInfo()
      console.log(r)
    },
    async executeMethod() {
      await executeMethod()
      await this.fetchCounterInfo()
    }
  }
})
</script>
<style>
body {
  margin: 0;
}
.sol {
  background: black;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.sol__btns {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-gap: 10px;
}

button {
  height: 50px;
  width: 180px;
  background: #6f66e1;
  color: white;
  border-color: black;
  border-radius: 500px;
  font-family: system-ui;
  font-weight: 600;
  font-size: 18px;
}
</style>
