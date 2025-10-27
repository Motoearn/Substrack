import { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase, SubscriptionPlan } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Check, ExternalLink, PauseCircle } from 'lucide-react';
import { StripeService } from '../services/stripeService';

export function Plans() {
  const { user, merchant } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    billing_cycle: 'monthly',
    features: [''],
  });

  useEffect(() => {
    if (user) {
      loadPlans();
    }
  }, [user]);

  const loadPlans = async () => {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('merchant_id', user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading plans:', error);
    } else {
      setPlans(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const planData = {
        merchant_id: user!.id,
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        currency: 'INR',
        billing_cycle: formData.billing_cycle,
        features: formData.features.filter((f) => f.trim() !== ''),
        is_active: true,
      };

      // Create new plan
      const { data: newPlan, error } = await supabase
        .from('subscription_plans')
        .insert(planData)
        .select()
        .single();

      if (error) throw error;

      // Create in Stripe if keys are configured
      if (merchant?.stripe_api_key && newPlan) {
        try {
          const stripeService = new StripeService(merchant.stripe_api_key);
          await stripeService.syncPlanToStripe(
            newPlan.id,
            formData.name,
            formData.description,
            parseFloat(formData.price),
            'INR',
            formData.billing_cycle
          );
        } catch (stripeError) {
          console.error('Failed to create plan in Stripe:', stripeError);
          alert('Plan created locally, but failed to sync with Stripe. Please check your Stripe keys in Settings.');
        }
      }

      setShowModal(false);
      resetForm();
      loadPlans();
    } catch (error: any) {
      console.error('Error saving plan:', error);
      alert('Failed to save plan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (plan: SubscriptionPlan) => {
    const newStatus = !plan.is_active;
    
    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_active: newStatus })
      .eq('id', plan.id);

    if (error) {
      console.error('Error toggling plan status:', error);
      alert('Failed to update plan status');
    } else {
      loadPlans();
      
      // Show user-friendly message
      if (newStatus) {
        alert('✅ Plan activated! New subscribers can now sign up for this plan.');
      } else {
        alert('⏸️ Plan paused. New subscriptions are temporarily disabled. Existing subscribers will continue to have access and auto-renew normally.');
      }
    }
  };

  const getPaymentLink = (plan: SubscriptionPlan): string => {
    if (!plan.stripe_price_id) return '#';
    const baseUrl = 'https://substrack.work.gd';
    return `${baseUrl}/subscribe/${plan.id}`;
  };

  const copyPaymentLink = (plan: SubscriptionPlan) => {
    const link = getPaymentLink(plan);
    navigator.clipboard.writeText(link);
    alert('✅ Payment link copied to clipboard!');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      billing_cycle: 'monthly',
      features: [''],
    });
  };

  const addFeature = () => {
    setFormData({ ...formData, features: [...formData.features, ''] });
  };

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  const removeFeature = (index: number) => {
    const newFeatures = formData.features.filter((_, i) => i !== index);
    setFormData({ ...formData, features: newFeatures });
  };

  const copyEmbedCode = () => {
    const merchantId = user?.id || 'YOUR_MERCHANT_ID';
    const code = `<!-- SubsTrack Subscription Widget -->
<div id="substrack-widget" data-merchant-id="${merchantId}"></div>
<script src="https://substrack.work.gd/widget.js" async></script>`;
    navigator.clipboard.writeText(code);
    alert('✅ Embed code copied to clipboard!');
  };

  return (
    <DashboardLayout title="Plans">
      {/* Stripe Warning */}
      {!merchant?.stripe_api_key && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-yellow-600 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Stripe not configured</h3>
              <p className="text-sm text-yellow-700 mt-1">
                To accept payments, please configure your Stripe API keys in{' '}
                <a href="/settings" className="underline font-semibold">
                  Settings
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-700">Manage Subscription Plans</h2>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage your subscription offerings. Use the toggle to pause/resume new subscriptions.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="mt-4 md:mt-0 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-xl shadow-sm p-6 flex flex-col justify-between border-2 transition-all ${
              plan.is_active 
                ? 'border-blue-200 hover:border-blue-300' 
                : 'border-orange-200 bg-orange-50/30'
            }`}
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-800">{plan.name}</h3>
                    {!plan.is_active && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded-full">
                        <PauseCircle className="w-3 h-3 mr-1" />
                        Paused
                      </span>
                    )}
                  </div>
                  {plan.stripe_product_id && plan.is_active && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full mt-1">
                      <Check className="w-3 h-3 mr-1" />
                      Active & Synced
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plan.is_active}
                      onChange={() => toggleActive(plan)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <span className="text-xs text-gray-500 mt-1">
                    {plan.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                ₹{plan.price}
                <span className="text-base font-medium text-gray-500">/{plan.billing_cycle}</span>
              </p>
              <p className="text-sm text-gray-500 mt-2">{plan.description}</p>
              <ul className="space-y-3 text-sm text-gray-600 my-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center">
                    <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-gray-500 mb-4 font-medium">
                {plan.subscriber_count || 0} Active Subscribers
              </p>
              
              {/* Show Payment Link or Paused Message */}
              {plan.is_active ? (
                <>
                  {plan.stripe_price_id && merchant?.stripe_api_key && (
                    <button
                      onClick={() => copyPaymentLink(plan)}
                      className="w-full bg-green-50 text-green-700 px-4 py-2 rounded-md font-semibold text-sm hover:bg-green-100 flex items-center justify-center transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Copy Payment Link
                    </button>
                  )}
                </>
              ) : (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                  <div className="flex items-start">
                    <PauseCircle className="w-5 h-5 text-orange-600 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-orange-800 mb-1">
                        Plan Temporarily Paused
                      </p>
                      <p className="text-xs text-orange-700">
                        New subscribers cannot sign up. Existing subscribers continue with normal access and auto-renewal.
                      </p>
                      <p className="text-xs text-orange-600 mt-2 font-medium">
                        Toggle ON to allow new subscriptions
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <div className="text-gray-400 text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No plans created yet</h3>
          <p className="text-gray-500 mb-4">Create your first subscription plan to get started</p>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Your First Plan
          </button>
        </div>
      )}

      <div className="mt-8 bg-white p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-2">Quick Tip</h3>
        <p className="text-sm text-gray-500">
          Copy the payment link and attach it to your subscription button. Your customers can start subscribing right away!
        </p>
      </div>

      {/* Modal for Create Plan */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Create New Plan
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Premium Plan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Describe what's included in this plan"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="299.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Billing Cycle
                    </label>
                    <select
                      value={formData.billing_cycle}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_cycle: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Features</label>
                  {formData.features.map((feature, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => updateFeature(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Feature description"
                      />
                      {formData.features.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFeature(index)}
                          className="px-3 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addFeature}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Feature
                  </button>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Plan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}