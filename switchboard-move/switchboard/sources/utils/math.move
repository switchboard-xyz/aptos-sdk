module switchboard::math {
    const EINCORRECT_STD_DEV: u64 = 0;
    const ENO_LENGTH_PASSED_IN_STD_DEV: u64 = 1;
    const EMORE_THAN_9_DECIMALS: u64 = 2;
    const EINPUT_TOO_LARGE: u64 = 3;

    const MAX_DECIMALS: u8 = 9;
    const POW_10_TO_MAX_DECIMALS: u128 = 1000000000;
    const U128_MAX: u128 = 340282366920938463463374607431768211455;
    const MAX_VALUE_ALLOWED: u128 = 340282366920938463463374607431;

    struct SwitchboardDecimal has copy, drop, store { value: u128, dec: u8, neg: bool }

    public fun max_u128(): u128 {
        U128_MAX
    }

    public fun new(value: u128, dec: u8, neg: bool): SwitchboardDecimal {
        assert!(
            dec <= MAX_DECIMALS,
            EMORE_THAN_9_DECIMALS
        );
        let num = SwitchboardDecimal { value, dec, neg };

        // expand nums out 
        num.value = scale_to_decimals(&num, MAX_DECIMALS);
        num.dec = MAX_DECIMALS;

        num
    }

    public fun pow(base: u64, exp: u8): u128 {
        let result_val = 1u128;
        let i = 0;
        while (i < exp) {
            result_val = result_val * (base as u128);
            i = i + 1;
        };
        result_val
    }

    public fun pow_10(exp: u8): u128 {
        pow(10, exp)
    }

    public fun unpack(num: SwitchboardDecimal): (u128, u8, bool) {
        let SwitchboardDecimal { value, dec, neg } = num;
        (value, dec, neg)
    }

    fun max(a: u8, b: u8): u8 {
        if (a > b) a else b
    }

    fun min(a: u8, b: u8): u8 {
        if (a > b) b else a
    }

    // abs(a - b)
    fun sub_abs_u8(a: u8, b: u8): u8 {
        if (a > b) {
            a - b
        } else {
            b - a
        }
    }

    public fun zero(): SwitchboardDecimal {
      SwitchboardDecimal {
        value: 0,
        dec: 0,
        neg: false
      }
    }

    // By reference 

    fun abs_gt(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal): bool {
        val1.value > val2.value
    }

    fun abs_lt(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal): bool {
        val1.value < val2.value
    }

    public fun add(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal): SwitchboardDecimal {
        // -x + -y
        if (val1.neg && val2.neg) {
            let sum = add_internal(val1, val2);
            sum.neg = true;
            sum
        // -x + y
        } else if (val1.neg) {
            sub_internal(val2, val1)
            
        // x + -y
        } else if (val2.neg) {
            sub_internal(val1, val2)

        // x + y
        } else {
            add_internal(val1, val2)
        }
    }

    fun add_internal(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal): SwitchboardDecimal {
        new(val1.value + val2.value, MAX_DECIMALS, false)
    }

    public fun sub(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal): SwitchboardDecimal {
        // -x - -y
        if (val1.neg && val2.neg) {
            let sum = add_internal(val1, val2);
            sum.neg = abs_gt(val1, val2);
            sum
        // -x - y
        } else if (val1.neg) {
            let sum = add_internal(val1, val2);
            sum.neg = true;
            sum
        // x - -y
        } else if (val2.neg) {
            add_internal(val1, val2)

         // x - y
        } else {
            sub_internal(val1, val2)
        }
    }

    fun sub_internal(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal): SwitchboardDecimal {
        if (val2.value > val1.value) {
            new(val2.value - val1.value, MAX_DECIMALS, true)
        } else {
            new(val1.value - val2.value, MAX_DECIMALS, false)
        }
    }


    public fun mul(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal, out: &mut SwitchboardDecimal) {
        let neg = !((val1.neg && val2.neg) || (!val1.neg && !val2.neg));
        mul_internal(val1, val2, out);
        out.neg = neg;
    }

    fun mul_internal(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal, out: &mut SwitchboardDecimal) {
        let multiplied = val1.value * val2.value;
        let new_decimals = val1.dec + val2.dec;
        let multiplied_scaled = if (new_decimals < MAX_DECIMALS) {
            let decimals_underflow = MAX_DECIMALS - new_decimals;
            multiplied * pow_10(decimals_underflow)
        } else if (new_decimals > MAX_DECIMALS) {
            let decimals_overflow = new_decimals - MAX_DECIMALS;
            multiplied / pow_10(decimals_overflow)
        } else {
            multiplied
        };

        out.value = multiplied_scaled;
        out.dec = MAX_DECIMALS;
        out.neg = false;
    }

    // babylonian
    public fun sqrt(num: &SwitchboardDecimal, out: &mut SwitchboardDecimal) {
        let y = num;
        out.value = y.value;
        out.neg = y.neg;
        out.dec = y.dec;
    }

    public fun div_original(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal, out: &mut SwitchboardDecimal) {
        let neg = !((val1.neg && val2.neg) || (!val1.neg && !val2.neg));
        let num1_scaled_with_overflow = val1.value * POW_10_TO_MAX_DECIMALS;
        out.value = num1_scaled_with_overflow / val2.value;
        out.dec = MAX_DECIMALS;
        out.neg = neg;
    }

    public fun gt(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal): bool {
        if (val1.neg && val2.neg) {
            return val1.value < val2.value
        } else if (val1.neg) {
            return false
        } else if (val2.neg) {
            return true
        };
        val1.value > val2.value
    }

    public fun lt(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal): bool {
       if (val1.neg && val2.neg) {
            return val1.value > val2.value
        } else if (val1.neg) {
            return true
        } else if (val2.neg) {
            return false
        };
        val1.value < val2.value
    }

    public fun gte(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal): bool {
        if (val1.neg && val2.neg) {
            return val1.value <= val2.value
        } else if (val1.neg) {
            return false
        } else if (val2.neg) {
            return true
        };
        val1.value >= val2.value
    }

    public fun lte(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal): bool {
       if (val1.neg && val2.neg) {
            return val1.value >= val2.value
        } else if (val1.neg) {
            return true
        } else if (val2.neg) {
            return false
        };
        val1.value <= val2.value
    }



    public fun equals(val1: &SwitchboardDecimal, val2: &SwitchboardDecimal): bool {
        let num1 = scale_to_decimals(val1, MAX_DECIMALS);
        let num2 = scale_to_decimals(val2, MAX_DECIMALS);
        num1 == num2 && val1.neg == val2.neg
    }

    public fun scale_to_decimals(num: &SwitchboardDecimal, scale_dec: u8): u128 {
        if (num.dec < scale_dec) {
            return (num.value * pow_10(scale_dec - num.dec))
        } else {
            return (num.value / pow_10(num.dec - scale_dec))
        }
    }
}
