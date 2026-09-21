-- Harden fulfillment: skip events for unknown/deleted users instead of raising.
CREATE OR REPLACE FUNCTION public.lull_fulfill_stripe_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  v_user uuid;
BEGIN
  IF NEW.provider <> 'stripe' OR NEW.processing_status <> 'processed'
     OR NEW.event_type NOT IN ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
                               'customer.subscription.paused', 'customer.subscription.resumed') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO s FROM public.stripe_subscription_state(NEW.payload);

  IF s.subject_id IS NULL THEN
    SELECT m.subject_type, m.subject_id INTO s.subject_type, s.subject_id
      FROM payments.customer_mappings m
     WHERE m.provider = 'stripe' AND m.environment = NEW.environment
       AND m.provider_customer_id = NEW.payload -> 'data' -> 'object' ->> 'customer';
  END IF;

  IF s.subject_type IS DISTINCT FROM 'user' OR s.subject_id IS NULL
     OR s.subject_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE WARNING 'lull: stripe event % has no resolvable user subject', NEW.provider_event_id;
    RETURN NEW;
  END IF;
  v_user := s.subject_id::uuid;

  -- Deleted or unknown accounts must never make webhook processing fail (FK would raise and retry forever).
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_user) THEN
    RAISE WARNING 'lull: stripe event % references unknown user', NEW.provider_event_id;
    RETURN NEW;
  END IF;

  INSERT INTO public.billing_entitlements AS e
    (user_id, provider, environment, status, price_id, plan_interval, current_period_end, cancel_at, provider_subscription_id, last_event_at, updated_at)
  VALUES
    (v_user, 'stripe', NEW.environment,
     CASE WHEN NEW.event_type = 'customer.subscription.deleted' THEN 'canceled' ELSE s.status END,
     s.price_id, s.plan_interval, s.current_period_end, s.cancel_at, s.subscription_id, coalesce(s.event_at, now()), now())
  ON CONFLICT (user_id) DO UPDATE SET
    provider = EXCLUDED.provider,
    environment = EXCLUDED.environment,
    status = EXCLUDED.status,
    price_id = EXCLUDED.price_id,
    plan_interval = EXCLUDED.plan_interval,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at = EXCLUDED.cancel_at,
    provider_subscription_id = EXCLUDED.provider_subscription_id,
    last_event_at = EXCLUDED.last_event_at,
    updated_at = now()
  -- Out-of-order safety: never let an older event overwrite newer state.
  WHERE e.last_event_at <= EXCLUDED.last_event_at;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.lull_fulfill_stripe_subscription() FROM PUBLIC, anon, authenticated;
