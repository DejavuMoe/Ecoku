import { mount } from 'svelte'
import './style.css'
import App from './App.svelte'
import { createAdminStore } from './stores/admin.svelte'

mount(App, { target: document.getElementById('app')!, context: new Map([['admin', createAdminStore()]]) })
