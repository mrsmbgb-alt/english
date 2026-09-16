/**
 * Auth Helper
 * 
 * বাংলা: অথেন্টিকেশন হেল্পার
 */

const Auth = {
    // Check if user is logged in
    async isLoggedIn() {
        try {
            const response = await API.auth.me();
            return response.success;
        } catch (error) {
            return false;
        }
    },
    
    // Get current user
    async getUser() {
        try {
            const response = await API.auth.me();
            return response.success ? response.data.user : null;
        } catch (error) {
            return null;
        }
    },
    
    // Require login (redirect if not logged in)
    async requireLogin() {
        const loggedIn = await this.isLoggedIn();
        
        if (!loggedIn) {
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login.html?return=${returnUrl}`;
            return null;
        }
        
        return await this.getUser();
    },
    
    // Login
    async login(email, password, rememberMe = false) {
        try {
            const response = await API.auth.login({
                email,
                password,
                remember_me: rememberMe
            });
            
            return response;
        } catch (error) {
            throw error;
        }
    },
    
    // Register
    async register(userData) {
        try {
            const response = await API.auth.register(userData);
            return response;
        } catch (error) {
            throw error;
        }
    },
    
    // Logout
    async logout() {
        try {
            await API.auth.logout();
            window.location.href = '/index.html';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/index.html';
        }
    }
};
