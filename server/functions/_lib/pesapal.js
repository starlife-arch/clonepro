import fetch from 'node-fetch';

const PESAPAL_CONFIG = {
    consumerKey: process.env.PESAPAL_CONSUMER_KEY,
    consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
    baseUrl: process.env.PESAPAL_BASE_URL
};

async function getAccessToken() {
    const url = `${PESAPAL_CONFIG.baseUrl}/api/Auth/RequestToken`;
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    const body = JSON.stringify({
        consumer_key: PESAPAL_CONFIG.consumerKey,
        consumer_secret: PESAPAL_CONFIG.consumerSecret
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body
        });
        const data = await response.json();
        if (response.ok) {
            return data.token;
        } else {
            console.error('Pesapal Auth Error:', data);
            throw new Error(data.message || 'Failed to get Pesapal access token');
        }
    } catch (error) {
        console.error('Error fetching Pesapal access token:', error);
        throw error;
    }
}

async function registerIpnUrl(accessToken, ipnUrl) {
    const url = `${PESAPAL_CONFIG.baseUrl}/api/URLSetup/RegisterIPN`;
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
    };
    const body = JSON.stringify({
        url: ipnUrl,
        ipn_notification_type: 'GET'
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body
        });
        const data = await response.json();
        if (response.ok) {
            return data.ipn_id;
        } else {
            console.error('Pesapal IPN Registration Error:', data);
            throw new Error(data.message || 'Failed to register Pesapal IPN URL');
        }
    } catch (error) {
        console.error('Error registering Pesapal IPN URL:', error);
        throw error;
    }
}

async function submitOrderRequest(accessToken, orderDetails) {
    const url = `${PESAPAL_CONFIG.baseUrl}/api/Transactions/SubmitOrderRequest`;
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
    };
    const body = JSON.stringify(orderDetails);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body
        });
        const data = await response.json();
        if (response.ok) {
            return data;
        } else {
            console.error('Pesapal Submit Order Error:', data);
            throw new Error(data.message || 'Failed to submit Pesapal order');
        }
    } catch (error) {
        console.error('Error submitting Pesapal order:', error);
        throw error;
    }
}

async function getTransactionStatus(accessToken, orderTrackingId) {
    const url = `${PESAPAL_CONFIG.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`;
    const headers = {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
    };

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: headers
        });
        const data = await response.json();
        if (response.ok) {
            return data;
        } else {
            console.error('Pesapal Get Transaction Status Error:', data);
            throw new Error(data.message || 'Failed to get Pesapal transaction status');
        }
    } catch (error) {
        console.error('Error getting Pesapal transaction status:', error);
        throw error;
    }
}

export {
    getAccessToken,
    registerIpnUrl,
    submitOrderRequest,
    getTransactionStatus
};
