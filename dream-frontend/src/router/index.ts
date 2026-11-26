/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import ForgotPasswordView from '../views/ForgotPasswordView.vue';
import ProfileView from '../views/ProfileView.vue';
import ChangePasswordView from '../views/account/ChangePasswordView.vue';
import ChangeEmailView from '../views/account/ChangeEmailView.vue';
import AccountSecurityView from '../views/account/AccountSecurityView.vue';
import AdminManagementView from '../views/admin/AdminManagementView.vue';
import { authBeforeEach } from './guard';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: { public: true },
    },
    {
      path: '/signup',
      name: 'signup',
      component: RegisterView,
      meta: { public: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPasswordView,
      meta: { public: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      meta: { requiresAuth: true, activeTab: 'profile' },
    },
    {
      path: '/account/change-password',
      name: 'account-change-password',
      component: ChangePasswordView,
      meta: { requiresAuth: true, activeTab: 'profile' },
    },
    {
      path: '/account/change-email',
      name: 'account-change-email',
      component: ChangeEmailView,
      meta: { requiresAuth: true, activeTab: 'profile' },
    },
    {
      path: '/account/security',
      name: 'account-security',
      component: AccountSecurityView,
      meta: { requiresAuth: true, activeTab: 'profile' },
    },
    {
      path: '/admin/admins',
      name: 'admin-admins',
      component: AdminManagementView,
      meta: { requiresAuth: true, allowedRoles: ['admin'], activeTab: 'profile' },
    },
  ],
});

router.beforeEach(async (to, from, next) => {
  await authBeforeEach(to, from, next);
});

export default router;
