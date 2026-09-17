type AnyRecord = Record<string, any>;

type NormalizedCustomerForm = {
  formType: string;
  normalized: AnyRecord;
  phone: string | null;
  fullName: string | null;
};

const buildBirthDate = (year?: string, month?: string, day?: string): string | undefined => {
  if (year && month && day) return `${year}/${month}/${day}`;
  return undefined;
};

const buildFullName = (firstName?: string, lastName?: string): string | null => {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  return full || null;
};

export function normalizeCustomerForm(formType: string, formData: AnyRecord): NormalizedCustomerForm {
  let normalized: AnyRecord = {};
  let canonicalFormType = formType;

  switch (formType) {
    case "buy_direct":
      normalized = {
        firstName: formData.nm,
        lastName: formData.fm,
        phone: formData.ph,
        province: formData.prov,
        city: formData.city,
        birthDate: buildBirthDate(formData.birthYear, formData.birthMonth, formData.birthDay),
        requestedSimNumber: formData.pref,
        howKnow: formData.hk,
      };
      break;

    case "buy_installment":
      normalized = {
        firstName: formData.nm,
        lastName: formData.fm,
        phone: formData.ph,
        price: formData.sp,
        howKnow: formData.hk,
      };
      break;

    case "buy_preorder":
      normalized = {
        firstName: formData.nm,
        lastName: formData.fm,
        phone: formData.ph,
        requestedSimNumber: formData.nt,
        howKnow: formData.hk,
      };
      break;

    case "sell_direct":
      normalized = {
        firstName: formData.dNm,
        lastName: formData.dFm,
        phone: formData.dPh,
        province: formData.dProv,
        city: formData.dCity,
        birthDate: buildBirthDate(formData.dBY, formData.dBM, formData.dBD),
        simNumber: formData.dSimPh,
        howKnow: formData.dHk,
      };
      break;

    case "sell_market":
      normalized = {
        firstName: formData.mNm,
        lastName: formData.mFm,
        phone: formData.mPh,
        province: formData.mProv,
        city: formData.mCity,
        birthDate: buildBirthDate(formData.mBY, formData.mBM, formData.mBD),
        simNumber: formData.mSimPh ?? formData.mSph,
        requestedSimNumber: formData.mDesPh,
        howKnow: formData.mHk,
      };
      break;

    case "sell_cons":
      normalized = {
        firstName: formData.nm,
        lastName: formData.fm,
        phone: formData.ph,
        province: formData.prov,
        city: formData.city,
        birthDate: buildBirthDate(formData.birthYear, formData.birthMonth, formData.birthDay),
        simNumber: formData.sph,
        price: formData.price,
        howKnow: formData.hk,
      };
      break;

    case "investment":
    case "invest_installment":
    case "invest_buy-sell":
      canonicalFormType = "investment";
      normalized = {
        firstName: formData.nm,
        lastName: formData.fm,
        phone: formData.ph,
        howKnow: formData.hk,
      };
      break;

    case "search":
    case "real_market_value":
    case "search_real_value":
      canonicalFormType = "search";
      normalized = {
        firstName: formData.nm,
        lastName: formData.fm,
        phone: formData.uph,
        simNumber: formData.uph,
        howKnow: formData.hk,
      };
      break;

    default:
      normalized = { ...formData };
      break;
  }

  const fullName = buildFullName(normalized.firstName, normalized.lastName);
  const phone = normalized.phone ?? null;

  return {
    formType: canonicalFormType,
    normalized: {
      ...normalized,
      fullName,
    },
    phone,
    fullName,
  };
}
