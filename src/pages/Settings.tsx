// src/pages/Settings.tsx - FIXED WITH WIDGET SUPPORT
import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, RefreshCw, Check, X, Copy, Upload, Image as ImageIcon, Download } from 'lucide-react';

export function Settings() {
  const { user, merchant, refreshMerchant } = useAuth();
  const [activeTab, setActiveTab] = useState('business');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showPublishableKey, setShowPublishableKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [testingStripe, setTestingStripe] = useState(false);
  const [stripeTestResult, setStripeTestResult] = useState<'success' | 'error' | null>(null);
  const [webhookUrlCopied, setWebhookUrlCopied] = useState(false);
  const [widgetIdCopied, setWidgetIdCopied] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');

  const [businessInfo, setBusinessInfo] = useState({
    full_name: '',
    business_name: '',
    email: '',
    phone: '',
    business_address: '',
    gst_number: '',
    logo_url: '',
  });

  const [stripeInfo, setStripeInfo] = useState({
    stripe_secret_key: '',
    stripe_publishable_key: '',
    stripe_webhook_secret: '',
  });

  const webhookUrl = `${window.location.origin.replace(window.location.hostname, 'niisdiotuzvydotoaurt.supabase.co')}/functions/v1/stripe-webhook`;

  // Get widget_id (use merchant's id as widget_id)
  const widgetId = merchant?.id || '';

  useEffect(() => {
    if (merchant) {
      setBusinessInfo({
        full_name: merchant.full_name || '',
        business_name: merchant.business_name || '',
        email: merchant.email || '',
        phone: (merchant as any).phone || '',
        business_address: merchant.bank_account || '',
        gst_number: merchant.gst_number || '',
        logo_url: merchant.logo_url || '',
      });
      setStripeInfo({
        stripe_secret_key: merchant.stripe_api_key || '',
        stripe_publishable_key: merchant.stripe_publishable_key || '',
        stripe_webhook_secret: (merchant as any).stripe_webhook_secret || '',
      });
      setLogoPreview(merchant.logo_url || null);
      setRedirectUrl((merchant as any).redirect_url || '');
    }
  }, [merchant]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File size should be less than 2MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return businessInfo.logo_url || null;

    setUploadingLogo(true);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${user!.id}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('merchant-assets')
        .upload(filePath, logoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('merchant-assets')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo. Please try again.');
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBusinessInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage('');

    try {
      const logoUrl = await uploadLogo();

      const { error } = await supabase
        .from('merchants')
        .update({
          full_name: businessInfo.full_name,
          business_name: businessInfo.business_name,
          phone: businessInfo.phone,
          bank_account: businessInfo.business_address,
          gst_number: businessInfo.gst_number,
          logo_url: logoUrl,
        })
        .eq('id', user!.id);

      if (error) throw error;

      await refreshMerchant();
      setSuccessMessage('Business information updated successfully!');
      setLogoFile(null);
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Error updating business info:', error);
      alert('Failed to update business information');
    } finally {
      setLoading(false);
    }
  };

  const validateStripeKey = (key: string, type: 'secret' | 'publishable'): boolean => {
    if (!key) return false;
    
    if (type === 'secret') {
      return key.startsWith('sk_test_') || key.startsWith('sk_live_');
    } else {
      return key.startsWith('pk_test_') || key.startsWith('pk_live_');
    }
  };

  const testStripeConnection = async () => {
    if (!validateStripeKey(stripeInfo.stripe_secret_key, 'secret')) {
      setStripeTestResult('error');
      alert('Invalid Stripe Secret Key format. Must start with sk_test_ or sk_live_');
      return;
    }

    setTestingStripe(true);
    setStripeTestResult(null);

    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeInfo.stripe_secret_key, {
        apiVersion: '2025-09-30.clover',
      });

      await stripe.products.list({ limit: 1 });
      setStripeTestResult('success');
    } catch (error) {
      console.error('Stripe test failed:', error);
      setStripeTestResult('error');
    } finally {
      setTestingStripe(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookUrlCopied(true);
    setTimeout(() => setWebhookUrlCopied(false), 2000);
  };

  const copyWidgetId = () => {
    navigator.clipboard.writeText(widgetId);
    setWidgetIdCopied(true);
    setTimeout(() => setWidgetIdCopied(false), 2000);
  };

  const handleStripeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage('');

    if (!validateStripeKey(stripeInfo.stripe_secret_key, 'secret')) {
      alert('Invalid Stripe Secret Key. Must start with sk_test_ or sk_live_');
      setLoading(false);
      return;
    }

    if (!validateStripeKey(stripeInfo.stripe_publishable_key, 'publishable')) {
      alert('Invalid Stripe Publishable Key. Must start with pk_test_ or pk_live_');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('merchants')
        .update({
          stripe_api_key: stripeInfo.stripe_secret_key,
          stripe_publishable_key: stripeInfo.stripe_publishable_key,
          stripe_webhook_secret: stripeInfo.stripe_webhook_secret,
        })
        .eq('id', user!.id);

      if (error) throw error;

      await refreshMerchant();
      setSuccessMessage('Stripe API keys updated successfully!');
      setStripeTestResult(null);
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Error updating Stripe keys:', error);
      alert('Failed to update Stripe API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleRedirectUrlSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage('');

    try {
      const { error } = await supabase
        .from('merchants')
        .update({ redirect_url: redirectUrl })
        .eq('id', user!.id);

      if (error) throw error;

      await refreshMerchant();
      setSuccessMessage('Redirect URL saved successfully!');
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Error saving redirect URL:', error);
      alert('Failed to save redirect URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-4xl">
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center">
            <Check className="w-5 h-5 mr-2" />
            {successMessage}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('business')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'business'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Business Profile
              </button>
              <button
                onClick={() => setActiveTab('stripe')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'stripe'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Stripe Integration
              </button>
              <button
                onClick={() => setActiveTab('widget')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'widget'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Widget Integration
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'business' && (
              <form onSubmit={handleBusinessInfoSubmit} className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Business Information</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    This information will appear on your invoices and payment pages.
                  </p>
                  
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Logo
                    </label>
                    <div className="flex items-center space-x-4">
                      <div className="h-24 w-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-10 w-10 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="logo-upload"
                          className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Logo
                        </label>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          value={businessInfo.full_name}
                          onChange={(e) =>
                            setBusinessInfo({ ...businessInfo, full_name: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Business Name *
                        </label>
                        <input
                          type="text"
                          value={businessInfo.business_name}
                          onChange={(e) =>
                            setBusinessInfo({ ...businessInfo, business_name: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Business Email *
                        </label>
                        <input
                          type="email"
                          value={businessInfo.email}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={businessInfo.phone}
                          onChange={(e) =>
                            setBusinessInfo({ ...businessInfo, phone: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="+91 98765 43210"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Business Address
                      </label>
                      <textarea
                        value={businessInfo.business_address}
                        onChange={(e) =>
                          setBusinessInfo({ ...businessInfo, business_address: e.target.value })
                        }
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter your complete business address"
                      />
                      <p className="text-xs text-gray-500 mt-1">This will appear on your invoices</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        GST Number
                      </label>
                      <input
                        type="text"
                        value={businessInfo.gst_number}
                        onChange={(e) =>
                          setBusinessInfo({ ...businessInfo, gst_number: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 22AAAAA0000A1Z5"
                      />
                      <p className="text-xs text-gray-500 mt-1">Optional - for Indian businesses</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading || uploadingLogo}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
                  >
                    {uploadingLogo ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : loading ? (
                      'Saving...'
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'stripe' && (
              <form onSubmit={handleStripeSubmit} className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Stripe Integration</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Connect your Stripe account to accept payments. Get your API keys from your{' '}
                    <a
                      href="https://dashboard.stripe.com/apikeys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Stripe Dashboard
                    </a>
                    .
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stripe Secret Key
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showSecretKey ? 'text' : 'password'}
                            value={stripeInfo.stripe_secret_key}
                            onChange={(e) =>
                              setStripeInfo({ ...stripeInfo, stripe_secret_key: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="sk_live_..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecretKey(!showSecretKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showSecretKey ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Starts with sk_live_ or sk_test_
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stripe Publishable Key
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showPublishableKey ? 'text' : 'password'}
                            value={stripeInfo.stripe_publishable_key}
                            onChange={(e) =>
                              setStripeInfo({
                                ...stripeInfo,
                                stripe_publishable_key: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="pk_live_..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowPublishableKey(!showPublishableKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showPublishableKey ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Starts with pk_live_ or pk_test_
                      </p>
                    </div>

                    <div className="border-t pt-4 mt-6">
                      <h4 className="text-md font-semibold text-gray-800 mb-3">Webhook Configuration</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Configure webhooks in your{' '}
                        <a
                          href="https://dashboard.stripe.com/webhooks"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Stripe Dashboard
                        </a>{' '}
                        to receive subscription updates.
                      </p>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Your Webhook URL
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={webhookUrl}
                            readOnly
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                          />
                          <button
                            type="button"
                            onClick={copyWebhookUrl}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            {webhookUrlCopied ? (
                              <>
                                <Check className="w-4 h-4 text-green-600" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-blue-800 font-medium mb-2">
                          📋 Setup Instructions:
                        </p>
                        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                          <li>Copy the webhook URL above</li>
                          <li>Go to Stripe Dashboard → Webhooks</li>
                          <li>Click "Add endpoint"</li>
                          <li>Paste the webhook URL</li>
                          <li>Select events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed</li>
                          <li>Copy the "Signing secret" (starts with whsec_)</li>
                          <li>Paste it below</li>
                        </ol>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Webhook Signing Secret
                        </label>
                        <div className="relative">
                          <input
                            type={showWebhookSecret ? 'text' : 'password'}
                            value={stripeInfo.stripe_webhook_secret}
                            onChange={(e) =>
                              setStripeInfo({
                                ...stripeInfo,
                                stripe_webhook_secret: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="whsec_..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showWebhookSecret ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Starts with whsec_
                        </p>
                      </div>
                    </div>

                    {stripeInfo.stripe_secret_key && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={testStripeConnection}
                          disabled={testingStripe}
                          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {testingStripe ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              Test Connection
                            </>
                          )}
                        </button>

                        {stripeTestResult === 'success' && (
                          <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                            <Check className="w-4 h-4" />
                            <span>Connection successful!</span>
                          </div>
                        )}

                        {stripeTestResult === 'error' && (
                          <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
                            <X className="w-4 h-4" />
                            <span>Connection failed. Check your keys.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save API Keys'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'widget' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">🚀 Widget Integration</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Embed subscription verification with automatic customer login - No backend needed!
                  </p>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h4 className="font-semibold text-blue-900">Your Widget ID</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white px-3 py-2 rounded border border-blue-300 font-mono text-sm">
                        {widgetId || 'Loading...'}
                      </code>
                      <button
                        type="button"
                        onClick={copyWidgetId}
                        disabled={!widgetId}
                        className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
                      >
                        {widgetIdCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                    <h4 className="text-md font-semibold text-gray-800 mb-2">Auto-Login After Payment</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      After customers subscribe, redirect them to your website with automatic access
                    </p>

                    <form onSubmit={handleRedirectUrlSave} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Your Website URL
                        </label>
                        <input
                          type="url"
                          value={redirectUrl}
                          onChange={(e) => setRedirectUrl(e.target.value)}
                          placeholder="https://yourwebsite.com/welcome"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Customers redirected here after payment with access token
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Redirect URL'
                        )}
                      </button>
                    </form>

                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h5 className="font-semibold text-blue-900 mb-2">📋 How It Works:</h5>
                      <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                        <li>Customer subscribes to your plan</li>
                        <li>Payment succeeds via Stripe</li>
                        <li>Redirected to: <code className="bg-blue-100 px-1 rounded text-xs">{redirectUrl || 'your-url'}?substrack_session=xxx</code></li>
                        <li>SDK auto-exchanges session for token</li>
                        <li>Customer logged in automatically ✅</li>
                      </ol>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                    <h4 className="text-md font-semibold text-gray-800 mb-3">📦 SDK Integration</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Add this script to your website:
                    </p>
                    
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm mb-2">
{`<!-- Add to your website's <head> or before </body> -->
<script src="${window.location.origin}/substrack-sdk.js"></script>

<script>
  // Initialize SDK
  const substrack = new Substrack();
  substrack.init().then(() => {
    
    // Check if user has subscription
    if (substrack.hasSubscription()) {
      // Show premium content
      document.getElementById('premium').style.display = 'block';
      
      // Get subscriber info
      const user = substrack.getSubscriber();
      console.log('Plan:', user.plan);
      console.log('Features:', user.features);
    } else {
      // Show subscribe button
      document.getElementById('subscribe-btn').style.display = 'block';
    }
  });
</script>`}
                    </pre>
                    
                    <button
                      type="button"
                      onClick={() => {
                        const code = `<script src="${window.location.origin}/substrack-sdk.js"></script>`;
                        navigator.clipboard.writeText(code);
                        alert('SDK code copied!');
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy SDK code
                    </button>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h5 className="font-semibold text-green-900 mb-2">🎯 Download Example</h5>
                    <p className="text-sm text-green-800 mb-3">
                      Download a working HTML example to test locally:
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const html = `<!DOCTYPE html>
<html>
<head>
  <title>Substrack Integration Test</title>
  <style>
    body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; }
    .premium { display: none; background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    button { background: #3b82f6; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; }
    button:hover { background: #2563eb; }
  </style>
</head>
<body>
  <h1>My Premium App 🚀</h1>
  <div id="substrack-status"></div>
  
  <div id="premium" class="premium">
    <h2>🎉 Welcome, Premium Member!</h2>
    <p>You have full access to all features.</p>
    <p>Your exclusive content appears here...</p>
  </div>
  
  <div id="subscribe-section">
    <h3>Upgrade to Premium</h3>
    <p>Subscribe now to unlock all features!</p>
    <!-- Replace PLAN_ID with your actual plan ID from Substrack dashboard -->
    <a href="${window.location.origin}/subscribe/YOUR_PLAN_ID">
      <button>Subscribe Now</button>
    </a>
  </div>

  <script src="${window.location.origin}/substrack-sdk.js"></script>
  <script>
    const substrack = new Substrack();
    substrack.init().then(() => {
      // Show widget badge
      substrack.showWidget('substrack-status');
      
      if (substrack.hasSubscription()) {
        // User has subscription - show premium content
        document.getElementById('premium').style.display = 'block';
        document.getElementById('subscribe-section').style.display = 'none';
        
        // Get subscriber details
        const subscriber = substrack.getSubscriber();
        console.log('Subscriber:', subscriber);
      } else {
        // No subscription - show subscribe button
        document.getElementById('premium').style.display = 'none';
        document.getElementById('subscribe-section').style.display = 'block';
      }
    });
  </script>
</body>
</html>`;
                        
                        const blob = new Blob([html], { type: 'text/html' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'substrack-test.html';
                        a.click();
                        window.URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Test HTML
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}