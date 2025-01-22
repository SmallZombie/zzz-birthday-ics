import { join } from '@std/path';
import { getDateByTimezone, getMonthByTimezone, timeout, Vcalendar, VcalendarBuilder } from './src/BaseUtil.ts';
import { getAllCharacters, getCharacterDetail } from './src/WikiController.ts';
import { ReleaseJsonType } from './src/type/ReleaseJsonType.ts';
import { UID_PREFIX } from './src/Const.ts';
import { existsSync } from "@std/fs/exists";


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
    const json = getJson();
    const characters = await getAllCharacters();

    let needSaveICS = false;
    let needSaveJSON = false;
    console.log('[!] Total Characters: ', characters.length);
    for (let i = 0; i < characters.length; i++) {
        const item = characters[i];
        const { birthday, release } = await getCharacterDetail(item.name);

        const birthdayMonth = getMonthByTimezone(birthday, ics.tzid);
        const birthdayDate = getDateByTimezone(birthday, ics.tzid);
        const releaseStr = `${release.getFullYear()}${String(release.getMonth() + 1).padStart(2, '0')}${String(release.getDate()).padStart(2, '0')}`;
        const rrule = `FREQ=YEARLY;BYMONTH=${String(birthdayMonth).padStart(2, '0')};BYMONTHDAY=${String(birthdayDate).padStart(2, '0')}`;

        let needSaveICSInThisCycle = false;
        let icsItem = ics.items.find(v => v.uid === UID_PREFIX + item.id);
        if (icsItem) {
            if (icsItem.dtstart !== releaseStr) {
                icsItem.dtstart = releaseStr;
                icsItem.rrule = rrule;
                needSaveICSInThisCycle = true;
            }
        } else {
            icsItem = {
                uid: UID_PREFIX + item.id,
                dtstamp: ics.dateToDateTime(new Date()),
                dtstart: releaseStr,
                rrule,
                summary: item.name
            }
            ics.items.push(icsItem);
            needSaveICSInThisCycle = true;
        }
        if (needSaveICSInThisCycle) {
            console.log(`${i + 1}/${characters.length} Update "${item.name}"(${item.id}) in ICS`);

            icsItem.dtstamp = ics.dateToDateTime(new Date());
            needSaveICS = true;
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
