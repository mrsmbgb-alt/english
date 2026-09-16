/**
 * API Client
 * 
 * বাংলা: API ক্লায়েন্ট
 */

const API = {
    BASE_URL: 'englishbd.infinityfreeapp.com', // ⚠️ CHANGE THIS
    
    // Helper: Make API request
    async request(endpoint, options = {}) {
        const url = `${this.BASE_URL}${endpoint}`;
        
        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            credentials: 'include', // Send cookies
            ...options
        };
        
        // Add CSRF token for mutations
        if (['POST', 'PUT', 'DELETE'].includes(config.method)) {
            const csrfToken = sessionStorage.getItem('csrf_token');
            if (csrfToken) {
                config.headers['X-CSRF-Token'] = csrfToken;
            }
        }
        
        // Add body for POST/PUT
        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }
        
        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
            
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    
    // Auth endpoints
    auth: {
        register: (userData) => API.request('/api/auth/register.php', {
            method: 'POST',
            body: userData
        }),
        
        login: (credentials) => API.request('/api/auth/login.php', {
            method: 'POST',
            body: credentials
        }),
        
        logout: () => API.request('/api/auth/logout.php', {
            method: 'POST'
        }),
        
        me: () => API.request('/api/auth/me.php')
    },
    
    // Courses endpoints
    courses: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/api/courses/list.php?${query}`);
        },
        
        detail: (slug) => API.request(`/api/courses/detail.php?slug=${slug}`),
        
        enroll: (slug) => API.request('/api/courses/enroll.php', {
            method: 'POST',
            body: { slug }
        })
    },
    
    // Lessons endpoints
    lessons: {
        get: (courseSlug, day) => API.request(
            `/api/lessons/get.php?course=${courseSlug}&day=${day}`
        ),
        
        complete: (courseId, day) => API.request('/api/lessons/complete.php', {
            method: 'POST',
            body: { course_id: courseId, day }
        })
    },
    
    // Quiz endpoints
    quiz: {
        get: (courseSlug, day) => API.request(
            `/api/quiz/get.php?course=${courseSlug}&day=${day}`
        ),
        
        submit: (courseId, day, answers) => API.request('/api/quiz/submit.php', {
            method: 'POST',
            body: { course_id: courseId, day, answers }
        })
    },
    
    // Progress endpoints
    progress: {
        dashboard: () => API.request('/api/progress/dashboard.php'),
        
        course: (slug) => API.request(`/api/progress/course.php?slug=${slug}`)
    }
};
