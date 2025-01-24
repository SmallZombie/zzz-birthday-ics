import { join } from '@std/path';
import { getDateByTimezone, getMonthByTimezone, timeout, Vcalendar, VcalendarBuilder, Vevent } from './src/BaseUtil.ts';
import { getAllCharacters, getCharacterDetail } from './src/WikiController.ts';
import { ReleaseJsonType } from './src/type/ReleaseJsonType.ts';
import { UID_PREFIX } from './src/Const.ts';
import { existsSync } from '@std/fs/exists';
import { getFullYearByTimezone } from './src/BaseUtil.ts';


const icsPath = join(Deno.cwd(), 'release.ics');
function getICS(): Vcalendar {
    if (existsSync(icsPath)) {
        return Vcalendar.fromString(Deno.readTextFileSync(icsPath));
    } else {
        const builder = new VcalendarBuilder();
        const vcalendar: Vcalendar = builder
            .setVersion('2.0')
            .setProdId('-//SmallZombie//ZZZ Birthday ICS//ZH')
            .setName('绝区零角色生日')
            .setRefreshInterval('P1D')
            .setCalScale('GREGORIAN')
            .setTzid('Asia/Shanghai')
            .setTzoffset('+0800')
            .build();
        return vcalendar;
    }
}

const jsonPath = join(Deno.cwd(), 'release.json');
function getJson(): ReleaseJsonType {
    if (existsSync(jsonPath)) {
        return JSON.parse(Deno.readTextFileSync(jsonPath)) as ReleaseJsonType;
    } else {
        return [];
    }
}

async function main() {
    const ics = getICS();
    let json = getJson();
    const characters = await getAllCharacters();

    let needSaveJSON = false;
    ics.items = ics.items.filter(v => {
        if (!characters.some(vv => UID_PREFIX + vv.id === v.uid)) {
            console.log(`[!] Remove "${v.summary}"(${v.uid}) in ICS`);
            return false;
        }
        return true;
    });
    json = json.filter(v => {
        if (!characters.some(vv => vv.id === v.id)) {
            console.log(`[!] Remove "${v.name}"(${v.id}) in JSON`);
            needSaveJSON = true;
            return false;
        }
        return true;
    });

    console.log('[!] Total Characters: ', characters.length);
    for (let i = 0; i < characters.length; i++) {
        const item = characters[i];
        const { birthday, release } = await getCharacterDetail(item.name);

        const birthdayMonth = getMonthByTimezone(birthday, ics.tzid);
        const birthdayDate = getDateByTimezone(birthday, ics.tzid);
        const releaseStr = `${getFullYearByTimezone(release, ics.tzid)}${String(getMonthByTimezone(release, ics.tzid)).padStart(2, '0')}${String(getDateByTimezone(release, ics.tzid)).padStart(2, '0')}`;
        const rrule = `FREQ=YEARLY;BYMONTH=${String(birthdayMonth).padStart(2, '0')};BYMONTHDAY=${String(birthdayDate).padStart(2, '0')}`;

        let icsItem = ics.items.find(v => v.uid === UID_PREFIX + item.id);
        if (!icsItem) {
            icsItem = new Vevent(UID_PREFIX + item.id, '', releaseStr);
            ics.items.push(icsItem);
        }
        icsItem.dtstart = releaseStr;
        icsItem.rrule = rrule;
        icsItem.summary = item.name;
        if (icsItem.hasChanged) {
            console.log(`${i + 1}/${characters.length} Update "${item.name}"(${item.id}) in ICS`);
        }

        let needSaveJSONInThisCycle = false;
        const jsonItem = json.find(v => v.id === item.id);
        if (jsonItem) {
            if (jsonItem.birthday.month !== birthdayMonth) {
                jsonItem.birthday.month = birthdayMonth;
                needSaveJSONInThisCycle = true;
            }
            if (jsonItem.birthday.day !== birthdayDate) {
                jsonItem.birthday.day = birthdayDate;
                needSaveJSONInThisCycle = true;
            }
            if (jsonItem.release !== release.toISOString()) {
                jsonItem.release = release.toISOString();
                needSaveJSONInThisCycle = true;
            }
        } else {
            json.push({
                id: item.id,
                name: item.name,
                birthday: {
                    month: birthdayMonth,
                    day: birthdayDate
                },
                release: release.toISOString()
            });
            needSaveJSONInThisCycle = true;
        }
        if (needSaveJSONInThisCycle) {
            console.log(`${i + 1}/${characters.length} Update "${item.name}"(${item.id}) in JSON`);
            needSaveJSON = true;
        }

        await timeout(200);
    }

    const needSaveICS = ics.items.some(v => v.hasChanged);
    if (needSaveICS) {
        const icsSavePath = join(Deno.cwd(), 'release.ics');
        Deno.writeTextFileSync(icsSavePath, ics.toString());
        console.log(`[√] ICS Has Save To "${icsSavePath}"`);
    }

    if (needSaveJSON) {
        const jsonSavePath = join(Deno.cwd(), 'release.json');
        Deno.writeTextFileSync(jsonSavePath, JSON.stringify(json, null, 4));
        console.log(`[√] JSON Has Save To "${jsonSavePath}"`);
    }

    if (!needSaveICS && !needSaveJSON) {
        console.log('[-] No need to save');
    }
}
main();
